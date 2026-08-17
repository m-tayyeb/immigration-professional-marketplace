"use server";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { Prisma, type AssessmentOutcome, type CaseStatus, type MatterType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../auth";
import { paymentGateway } from "./payments";
import { prisma } from "./prisma";
import { assessmentRequestFields, canDecideAssessmentRequest, caseContactSnapshot, isCompleteClientContact, parseConsultationMethod, parseOptionalDate } from "./assessment-intake";
import { assessmentPaymentAllowed } from "./appointment-workflow";
import { assessmentRequestDecisionStatus, canManuallyTransitionCaseStatus, canPayAssessmentFee, canRequestRemainingPayment, completedChecklistTitleAfterPayment, requestedDocumentsReceivedTitle, statusAfterPayment } from "./case-workflow";
import { caseAccessWhere, professionalEligibilityWhere, selectProfessionalForAssignment } from "./professional-assignment";
import { buildDoNotProceedDecisionEvidence, buildProceedDecisionEvidence, canRecordClientDecision, deriveServiceAgreementAmounts, hasFinancialAcknowledgement } from "./service-agreement";
import { canConfirmDocumentCollection, remainingAmountFromDecision } from "./document-workflow";
import { documentStorage, storeDocumentWithRollback } from "./document-storage";

async function sessionUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user;
}

async function ownedCase(caseId: string) {
  const user = await sessionUser();
  const record = await prisma.case.findFirst({
    where: caseAccessWhere(caseId, user),
    include: { service: true, payments: true, assessment: true, serviceDecision: true, documentCompletion: true, documentRequirements: true, checklist: true, documents: true, professional: { include: { user: true } }, appointments: { where: { purpose: "ASSESSMENT_CONSULTATION" }, select: { id: true, status: true } } },
  });
  if (!record) throw new Error("Case not found or access denied.");
  return { user, record };
}

export async function createCase(formData: FormData) {
  const user = await sessionUser();
  if (user.role !== "CLIENT") throw new Error("Only clients can create cases.");
  const serviceId = String(formData.get("serviceId") ?? "");
  const countryId = String(formData.get("countryId") ?? "");
  const matterType = String(formData.get("matterType") ?? "IMMIGRATION") as MatterType;
  const matterDescription = String(formData.get("matterDescription") ?? "").trim();
  const situationDescription = String(formData.get("situationDescription") ?? "").trim();
  const preferredConsultationMethod = parseConsultationMethod(formData.get("preferredConsultationMethod"));
  const preferredAvailability = String(formData.get("preferredAvailability") ?? "").trim();
  const relevantDeadline = parseOptionalDate(formData.get("relevantDeadline"));
  const additionalMessage = String(formData.get("additionalMessage") ?? "").trim();
  if (!serviceId || !countryId || !situationDescription || !preferredConsultationMethod || relevantDeadline === undefined || (matterType === "OTHER" && !matterDescription)) throw new Error("Complete the assessment request intake.");
  const [client, service, assignableProfessionals] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, include: { clientProfile: true } }),
    prisma.immigrationService.findFirst({ where: { id: serviceId, active: true } }),
    prisma.professionalProfile.findMany({
      where: professionalEligibilityWhere(countryId, serviceId),
      select: { id: true, createdAt: true, verificationStatus: true, acceptingNewCases: true, countries: { select: { countryId: true } }, services: { select: { serviceId: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!client || !isCompleteClientContact({ name: client.name, email: client.email, profile: client.clientProfile })) throw new Error("Complete your client contact profile before requesting an assessment.");
  const contactSnapshot = caseContactSnapshot({ name: client.name, email: client.email, profile: client.clientProfile });
  const professional = selectProfessionalForAssignment(assignableProfessionals, countryId, serviceId);
  if (!service || !professional) throw new Error("No verified professional is currently available for this selection.");
  const created = await prisma.case.create({
    data: {
      clientId: user.id, professionalId: professional.id, countryId, serviceId,
      matterType, matterDescription: matterDescription || null,
      ...assessmentRequestFields({ situationDescription, preferredConsultationMethod, preferredAvailability, relevantDeadline, additionalMessage }),
      contactSnapshot: { create: contactSnapshot },
      checklist: { create: [
        { title: "Assessment completed", position: 1 },
        { title: "Client confirms they want to proceed", clientAction: true, position: 2 },
        { title: requestedDocumentsReceivedTitle, position: 3 },
        { title: "Remaining balance paid", clientAction: true, position: 4 },
        { title: "Professional reviews client documents", position: 5 },
        { title: "Main work completed", position: 6 },
        { title: "Professional documents prepared and released", position: 7 },
      ] },
      timeline: { create: { title: "Assessment requested", details: "The professional will review the initial request before payment is requested." } },
    },
  });
  redirect(`/cases/${created.id}`);
}

export async function payRequest(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  const { user, record } = await ownedCase(caseId);
  if (user.role !== "CLIENT") throw new Error("Only the client can make this payment.");
  const payment = record.payments.find((item) => item.id === paymentId && item.status === "PENDING");
  if (!payment) throw new Error("Payment request is not available.");
  if (payment.stage === "ASSESSMENT" && (!canPayAssessmentFee(record.status) || !assessmentPaymentAllowed(record.status, record.appointments[0]?.status ?? null))) throw new Error("A confirmed assessment appointment is required before payment.");
  await paymentGateway.markPaid(payment.id);
  if (payment.stage === "ASSESSMENT") {
    await prisma.case.update({ where: { id: caseId }, data: { status: statusAfterPayment(payment.stage), timeline: { create: { title: "Assessment fee paid", details: "The professional can begin the assessment." } } } });
  } else {
    await prisma.case.update({ where: { id: caseId }, data: { status: statusAfterPayment(payment.stage), checklist: { updateMany: { where: { title: completedChecklistTitleAfterPayment(payment.stage) ?? undefined }, data: { completedAt: new Date() } } }, timeline: { create: { title: "Remaining balance paid" } } } });
  }
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/dashboard");
}

export async function approveAssessmentRequest(formData: FormData) {
  void formData;
  throw new Error("Use the appointment agreement workflow to approve an assessment request.");
}

export async function declineAssessmentRequest(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const { user, record } = await ownedCase(caseId);
  if (!canDecideAssessmentRequest(user, record.professional.userId, record.status)) throw new Error("Professional access required.");
  const nextStatus = assessmentRequestDecisionStatus(record.status, "DECLINE");
  if (!nextStatus) throw new Error("This assessment request cannot be declined.");
  const declinedAt = new Date();
  const declineReason = String(formData.get("declineReason") ?? "").trim();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.case.updateMany({ where: { id: caseId, status: "AWAITING_ASSESSMENT_REVIEW" }, data: { status: nextStatus, completedAt: declinedAt, declineReason: declineReason || null } });
    if (updated.count !== 1) throw new Error("This assessment request has already been decided.");
    await tx.paymentRequest.updateMany({ where: { caseId, stage: "ASSESSMENT", status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.caseAppointment.updateMany({ where: { caseId, purpose: "ASSESSMENT_CONSULTATION", status: { in: ["PROPOSED", "CHANGE_REQUESTED", "CONFIRMED"] } }, data: { status: "CANCELLED", cancelledAt: declinedAt, cancellationReason: declineReason || "Assessment request declined." } });
    await tx.notification.create({ data: { userId: record.clientId, caseId, appointmentId: record.appointments[0]?.id, type: "APPOINTMENT_CANCELLED", title: "Assessment request declined", message: declineReason || "The professional declined the assessment request." } });
    await tx.caseTimelineEvent.create({ data: { caseId, title: "Assessment request declined", details: declineReason || "No assessment payment is due and assessment work will not begin." } });
  });
  revalidatePath(`/professional/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/dashboard");
}

export async function agreeToProceed(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const { user, record } = await ownedCase(caseId);
  if (!canRecordClientDecision({ userId: user.id, userRole: user.role, caseClientId: record.clientId, status: record.status, assessmentReleased: Boolean(record.assessment?.releasedAt), existingDecision: record.assessment?.clientDecision ?? null, agreementExists: Boolean(record.serviceDecision) })) throw new Error("This decision is not available.");
  if (!hasFinancialAcknowledgement(formData.get("financialAcknowledgement"))) throw new Error("Confirm the remaining financial obligation before proceeding.");
  const assessmentPayment = record.payments.find((payment) => payment.stage === "ASSESSMENT" && payment.status === "PAID");
  if (!assessmentPayment) throw new Error("A paid assessment is required before proceeding.");
  const amounts = deriveServiceAgreementAmounts(record.service.totalPrice ? Number(record.service.totalPrice) : null, Number(assessmentPayment.amount));
  if (!amounts) throw new Error("The service price must be configured before the client can proceed.");
  const decidedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const decision = await tx.caseAssessment.updateMany({ where: { caseId, clientDecision: null }, data: { clientDecision: "PROCEED", decidedAt } });
    if (decision.count !== 1) throw new Error("A client decision has already been recorded.");
    await tx.caseServiceDecision.create({ data: { caseId, clientId: user.id, ...buildProceedDecisionEvidence(amounts, decidedAt) } });
    const updated = await tx.case.updateMany({ where: { id: caseId, status: "AWAITING_CLIENT_DECISION" }, data: { clientAgreedAt: decidedAt, status: "AWAITING_DOCUMENTS_AND_PAYMENT" } });
    if (updated.count !== 1) throw new Error("This case no longer permits a client decision.");
    await tx.caseChecklistItem.updateMany({ where: { caseId, title: "Client confirms they want to proceed", clientAction: true }, data: { completedAt: decidedAt } });
    await tx.caseTimelineEvent.create({ data: { caseId, title: "Client chose to proceed", details: `The client formally authorized the service and acknowledged a remaining obligation of €${amounts.remainingAmountAcknowledged.toFixed(2)}.` } });
  });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/professional/cases/${caseId}`);
}

export async function doNotProceed(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const { user, record } = await ownedCase(caseId);
  if (!canRecordClientDecision({ userId: user.id, userRole: user.role, caseClientId: record.clientId, status: record.status, assessmentReleased: Boolean(record.assessment?.releasedAt), existingDecision: record.assessment?.clientDecision ?? null, agreementExists: Boolean(record.serviceDecision) })) throw new Error("This decision is not available.");
  const decidedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const decision = await tx.caseAssessment.updateMany({ where: { caseId, clientDecision: null }, data: { clientDecision: "DO_NOT_PROCEED", decidedAt } });
    if (decision.count !== 1) throw new Error("A client decision has already been recorded.");
    await tx.caseServiceDecision.create({ data: { caseId, clientId: user.id, ...buildDoNotProceedDecisionEvidence(decidedAt) } });
    await tx.paymentRequest.updateMany({ where: { caseId, stage: "REMAINING_BALANCE", status: "PENDING" }, data: { status: "CANCELLED" } });
    const updated = await tx.case.updateMany({ where: { id: caseId, status: "AWAITING_CLIENT_DECISION" }, data: { status: "CANCELLED", completedAt: decidedAt } });
    if (updated.count !== 1) throw new Error("This case no longer permits a client decision.");
    await tx.caseTimelineEvent.create({ data: { caseId, title: "Client chose not to proceed", details: "The case was stopped after the assessment. No remaining payment was requested or acknowledged." } });
  });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/professional/cases/${caseId}`);
  revalidatePath("/dashboard");
}

export async function releaseAssessment(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const outcome = String(formData.get("outcome") ?? "") as AssessmentOutcome;
  const assessmentText = String(formData.get("assessmentText") ?? "").trim();
  const recommendedRoute = String(formData.get("recommendedRoute") ?? "").trim();
  const issuesRisks = String(formData.get("issuesRisks") ?? "").trim();
  const nextSteps = String(formData.get("nextSteps") ?? "").trim();
  const { user, record } = await ownedCase(caseId);
  if (user.role === "CLIENT") throw new Error("Professional access required.");
  if (record.status !== "ASSESSMENT_IN_PROGRESS") throw new Error("Move the case to Assessment in progress before releasing the assessment.");
  if (record.assessment?.releasedAt) throw new Error("This assessment has already been released.");
  if (!(["ELIGIBLE", "POTENTIALLY_ELIGIBLE", "MORE_INFORMATION_REQUIRED", "NOT_RECOMMENDED"] as string[]).includes(outcome) || !assessmentText || !recommendedRoute || !issuesRisks || !nextSteps) throw new Error("Complete every assessment field before release.");
  const releasedAt = new Date();
  await prisma.$transaction([
    prisma.caseAssessment.upsert({
      where: { caseId },
      update: { outcome, assessmentText, recommendedRoute, issuesRisks, nextSteps, releasedAt, clientDecision: null, decidedAt: null },
      create: { caseId, outcome, assessmentText, recommendedRoute, issuesRisks, nextSteps, releasedAt },
    }),
    prisma.case.update({ where: { id: caseId }, data: { status: "AWAITING_CLIENT_DECISION", checklist: { updateMany: { where: { title: "Assessment completed", clientAction: false }, data: { completedAt: releasedAt } } }, timeline: { create: { title: "Assessment completed and released to client", details: "The client can now review the assessment and decide whether to proceed." } } } }),
  ]);
  revalidatePath(`/professional/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/dashboard");
}

export async function requestRemainingPayment(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const { user, record } = await ownedCase(caseId);
  if (user.role !== "PROFESSIONAL" && user.role !== "ADMIN") throw new Error("Professional access required.");
  const assessment = record.payments.find((item) => item.stage === "ASSESSMENT");
  const requestedDocumentsConfirmed = Boolean(record.documentCompletion) && canConfirmDocumentCollection(record.documentRequirements);
  if (!canRequestRemainingPayment({ assessmentPaid: assessment?.status === "PAID", status: record.status, clientDecision: record.assessment?.clientDecision ?? null, requestedDocumentsConfirmed: Boolean(requestedDocumentsConfirmed) })) {
    throw new Error("The client must proceed and the professional must confirm receipt of the requested documents before requesting the remaining payment.");
  }
  const amount = record.serviceDecision ? remainingAmountFromDecision({ decision: record.serviceDecision.decision, financialObligationConfirmed: record.serviceDecision.financialObligationConfirmed, remainingAmountAcknowledged: record.serviceDecision.remainingAmountAcknowledged === null ? null : Number(record.serviceDecision.remainingAmountAcknowledged) }) : null;
  if (amount === null) throw new Error("A binding Proceed decision with a recorded remaining obligation is required.");
  try {
    await prisma.$transaction([
      prisma.paymentRequest.create({ data: { caseId, stage: "REMAINING_BALANCE", amount } }),
      prisma.caseTimelineEvent.create({ data: { caseId, title: "Remaining payment requested", details: `€${amount.toFixed(2)} is due.` } }),
      prisma.notification.create({ data: { userId: record.clientId, caseId, type: "REMAINING_PAYMENT_DUE", title: "Remaining payment due", message: `The remaining payment of €${amount.toFixed(2)} is now due.` } }),
    ]);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
  }
  revalidatePath(`/professional/cases/${caseId}`);
}

export async function addChecklistItem(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const { user } = await ownedCase(caseId);
  if (user.role === "CLIENT" || !title) throw new Error("Professional access required.");
  const count = await prisma.caseChecklistItem.count({ where: { caseId } });
  await prisma.caseChecklistItem.create({ data: { caseId, title, clientAction: formData.get("clientAction") === "on", position: count + 1 } });
  revalidatePath(`/professional/cases/${caseId}`);
}

export async function toggleChecklistItem(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const { user, record } = await ownedCase(caseId);
  if (user.role === "CLIENT") throw new Error("Professional access required.");
  const item = await prisma.caseChecklistItem.findFirst({ where: { id: itemId, caseId } });
  if (!item) throw new Error("Checklist item not found.");
  const isRequestedDocumentsConfirmation = item.title === requestedDocumentsReceivedTitle;
  if (isRequestedDocumentsConfirmation) throw new Error("Use the document requirement completion action.");
  if (item.clientAction) throw new Error("Client action items can only be completed by the related client action.");
  await prisma.caseChecklistItem.update({ where: { id: item.id }, data: { completedAt: item.completedAt ? null : new Date() } });
  revalidatePath(`/professional/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
}

export async function updateCaseStatus(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const status = String(formData.get("status") ?? "") as CaseStatus;
  const { user, record } = await ownedCase(caseId);
  if (user.role === "CLIENT") throw new Error("Professional access required.");
  const assessmentPaid = record.payments.some((payment) => payment.stage === "ASSESSMENT" && payment.status === "PAID");
  if (!canManuallyTransitionCaseStatus(record.status, status, assessmentPaid)) {
    throw new Error("This case status transition is not available.");
  }
  await prisma.case.update({ where: { id: caseId }, data: { status, completedAt: status === "COMPLETED" ? new Date() : null, timeline: { create: { title: `Status changed to ${status.replaceAll("_", " ").toLowerCase()}` } } } });
  revalidatePath(`/professional/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
}

export async function addMessage(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const { user } = await ownedCase(caseId);
  if (!body) return;
  await prisma.caseMessage.create({ data: { caseId, authorId: user.id, body, internal: user.role !== "CLIENT" && formData.get("internal") === "on" } });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/professional/cases/${caseId}`);
}

export async function addTimelineEvent(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const { user } = await ownedCase(caseId);
  if (user.role === "CLIENT" || !title) throw new Error("Professional access required.");
  await prisma.caseTimelineEvent.create({ data: { caseId, title, details: details || null, visibleToClient: formData.get("private") !== "on" } });
  revalidatePath(`/professional/cases/${caseId}`);
}

export async function uploadDocument(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const file = formData.get("file");
  const { user } = await ownedCase(caseId);
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) throw new Error("Choose a file up to 10 MB.");
  const folder = user.role === "CLIENT" ? "CLIENT" : "PROFESSIONAL";
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${caseId}/${randomUUID()}-${safeName}`;
  const contentType = file.type || "application/octet-stream";
  await storeDocumentWithRollback({ storage: documentStorage(), key: storageKey, contents: Buffer.from(await file.arrayBuffer()), contentType, commit: (storedKey) => prisma.caseDocument.create({ data: { caseId, uploadedById: user.id, folder, fileName: safeName, storageKey: storedKey, mimeType: contentType, size: file.size, releasedToClientAt: folder === "PROFESSIONAL" && formData.get("release") === "on" ? new Date() : null } }) });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/professional/cases/${caseId}`);
}

export async function releaseDocument(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const { user } = await ownedCase(caseId);
  if (user.role === "CLIENT") throw new Error("Professional access required.");
  await prisma.caseDocument.updateMany({ where: { id: documentId, caseId, folder: "PROFESSIONAL" }, data: { releasedToClientAt: new Date() } });
  revalidatePath(`/professional/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
}
