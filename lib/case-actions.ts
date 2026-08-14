"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssessmentOutcome, CaseStatus, MatterType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../auth";
import { paymentGateway } from "./payments";
import { prisma } from "./prisma";

async function sessionUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user;
}

async function ownedCase(caseId: string) {
  const user = await sessionUser();
  const record = await prisma.case.findFirst({
    where: user.role === "CLIENT" ? { id: caseId, clientId: user.id } : user.role === "PROFESSIONAL" ? { id: caseId, professional: { userId: user.id } } : { id: caseId },
    include: { service: true, payments: true, assessment: true },
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
  if (!serviceId || !countryId || (matterType === "OTHER" && !matterDescription)) throw new Error("Complete the service intake.");
  const [service, professional] = await Promise.all([
    prisma.immigrationService.findFirst({ where: { id: serviceId, active: true } }),
    prisma.professionalProfile.findFirst({ where: { verificationStatus: "VERIFIED", countries: { some: { countryId } } }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!service || !professional) throw new Error("No verified professional is currently available for this selection.");
  const created = await prisma.case.create({
    data: {
      clientId: user.id, professionalId: professional.id, countryId, serviceId,
      matterType, matterDescription: matterDescription || null,
      payments: { create: { stage: "ASSESSMENT", amount: service.assessmentFee } },
      checklist: { create: [
        { title: "Assessment completed", position: 1 },
        { title: "Client confirms they want to proceed", clientAction: true, position: 2 },
        { title: "Requested client documents received", clientAction: true, position: 3 },
        { title: "Remaining balance paid", clientAction: true, position: 4 },
        { title: "Professional reviews client documents", position: 5 },
        { title: "Main work completed", position: 6 },
        { title: "Professional documents prepared and released", position: 7 },
      ] },
      timeline: { create: { title: "Case created", details: "Assessment payment is due." } },
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
  await paymentGateway.markPaid(payment.id);
  if (payment.stage === "ASSESSMENT") {
    await prisma.case.update({ where: { id: caseId }, data: { status: "ASSESSMENT_PAID", timeline: { create: { title: "Assessment fee paid", details: "The professional can begin the assessment." } } } });
  } else {
    await prisma.case.update({ where: { id: caseId }, data: { status: "DOCUMENT_REVIEW", checklist: { updateMany: { where: { title: "Remaining balance paid" }, data: { completedAt: new Date() } } }, timeline: { create: { title: "Remaining balance paid" } } } });
  }
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/dashboard");
}

export async function agreeToProceed(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const { user, record } = await ownedCase(caseId);
  if (user.role !== "CLIENT" || record.status !== "AWAITING_CLIENT_DECISION" || !record.assessment?.releasedAt || record.assessment.clientDecision) throw new Error("This decision is not available.");
  const decidedAt = new Date();
  await prisma.$transaction([
    prisma.caseAssessment.update({ where: { caseId }, data: { clientDecision: "PROCEED", decidedAt } }),
    prisma.case.update({ where: { id: caseId }, data: { clientAgreedAt: decidedAt, status: "AWAITING_DOCUMENTS_AND_PAYMENT", checklist: { updateMany: { where: { title: "Client confirms they want to proceed", clientAction: true }, data: { completedAt: decidedAt } } }, timeline: { create: { title: "Client chose to proceed", details: "The professional can now request documents and the remaining payment." } } } }),
  ]);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/professional/cases/${caseId}`);
}

export async function doNotProceed(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const { user, record } = await ownedCase(caseId);
  if (user.role !== "CLIENT" || record.status !== "AWAITING_CLIENT_DECISION" || !record.assessment?.releasedAt || record.assessment.clientDecision) throw new Error("This decision is not available.");
  const decidedAt = new Date();
  await prisma.$transaction([
    prisma.caseAssessment.update({ where: { caseId }, data: { clientDecision: "DO_NOT_PROCEED", decidedAt } }),
    prisma.paymentRequest.updateMany({ where: { caseId, stage: "REMAINING_BALANCE", status: "PENDING" }, data: { status: "CANCELLED" } }),
    prisma.case.update({ where: { id: caseId }, data: { status: "CANCELLED", completedAt: decidedAt, timeline: { create: { title: "Client chose not to proceed", details: "The case was stopped after the assessment. No remaining payment was requested." } } } }),
  ]);
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
  if (assessment?.status !== "PAID") throw new Error("The assessment must be paid first.");
  if (record.status !== "AWAITING_DOCUMENTS_AND_PAYMENT" || record.assessment?.clientDecision !== "PROCEED") throw new Error("The client must choose to proceed before a remaining payment can be requested.");
  const isOther = record.service.code === "OTHER";
  const entered = Number(formData.get("amount"));
  const amount = isOther ? entered : Number(record.service.totalPrice) - Number(record.service.assessmentFee);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid remaining amount.");
  await prisma.paymentRequest.upsert({
    where: { caseId_stage: { caseId, stage: "REMAINING_BALANCE" } },
    update: { amount, status: "PENDING", requestedAt: new Date(), paidAt: null, providerReference: null },
    create: { caseId, stage: "REMAINING_BALANCE", amount },
  });
  await prisma.caseTimelineEvent.create({ data: { caseId, title: "Remaining payment requested", details: `€${amount.toFixed(2)} is due.` } });
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
  const { user } = await ownedCase(caseId);
  if (user.role === "CLIENT") throw new Error("Professional access required.");
  const item = await prisma.caseChecklistItem.findFirst({ where: { id: itemId, caseId } });
  if (!item) throw new Error("Checklist item not found.");
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
  if (status === "AWAITING_CLIENT_DECISION" && !record.assessment?.releasedAt) throw new Error("Release the assessment to move the case to Awaiting your decision.");
  if (status === "AWAITING_DOCUMENTS_AND_PAYMENT" && record.assessment?.clientDecision !== "PROCEED") throw new Error("The client must choose to proceed first.");
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
  const root = path.join(process.cwd(), ".private-uploads");
  const fullPath = path.join(root, storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));
  await prisma.caseDocument.create({ data: { caseId, uploadedById: user.id, folder, fileName: safeName, storageKey, mimeType: file.type || "application/octet-stream", size: file.size, releasedToClientAt: folder === "PROFESSIONAL" && formData.get("release") === "on" ? new Date() : null } });
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
