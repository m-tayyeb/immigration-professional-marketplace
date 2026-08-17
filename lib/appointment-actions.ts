"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../auth";
import { appointmentFields, localAppointmentToUtc, parseConsultationMethod, validateAppointmentInput } from "./assessment-intake";
import { activeAppointmentForPurpose, appointmentConfirmationEffect, canClientManageAppointment, canOfficiallyManageAppointment, canWithdrawAssessment, parseAppointmentPurpose, parseConfirmationSource } from "./appointment-workflow";
import { caseAccessWhere } from "./professional-assignment";
import { prisma } from "./prisma";
import { canStartFinalReviewAppointment } from "./document-workflow";

async function appointmentCase(caseId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const record = await prisma.case.findFirst({
    where: caseAccessWhere(caseId, session.user),
    include: {
      service: true,
      payments: true,
      professional: { include: { user: true } },
      appointments: { include: { revisions: { orderBy: { createdAt: "desc" } } }, orderBy: { updatedAt: "desc" } },
    },
  });
  if (!record) throw new Error("Case not found or access denied.");
  return { user: session.user, record };
}

function assertPurposeGate(record: { status: string; fileReadyAt: Date | null; payments: { stage: string; status: string }[] }, purpose: string) {
  if (purpose === "ASSESSMENT_CONSULTATION" && !["AWAITING_ASSESSMENT_REVIEW", "AWAITING_ASSESSMENT_PAYMENT"].includes(record.status)) throw new Error("This assessment consultation cannot be managed now.");
  if (purpose === "FINAL_FILE_REVIEW" && !canStartFinalReviewAppointment(record.payments.some((payment) => payment.stage === "REMAINING_BALANCE" && payment.status === "PAID"), Boolean(record.fileReadyAt))) throw new Error("The file must be ready and the remaining payment paid before final review can be booked.");
}

function proposalFromForm(formData: FormData) {
  const timeZone = String(formData.get("timeZone") ?? "").trim();
  const input = {
    method: parseConsultationMethod(formData.get("method")),
    appointmentAtUtc: localAppointmentToUtc(String(formData.get("localDateTime") ?? ""), timeZone),
    timeZone,
    instructions: String(formData.get("instructions") ?? "").trim(),
    professionalMessage: String(formData.get("message") ?? "").trim(),
  };
  if (!validateAppointmentInput(input)) throw new Error("Enter a valid, unambiguous local appointment time, IANA time zone, method, and instructions.");
  return appointmentFields(input);
}

function refreshCase(caseId: string) {
  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/professional/cases/${caseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/professional");
}

async function activeAppointmentInTransaction(tx: Prisma.TransactionClient, caseId: string, purpose: "ASSESSMENT_CONSULTATION" | "FINAL_FILE_REVIEW" | "SUPPLEMENTARY_REQUEST") {
  return tx.caseAppointment.findFirst({
    where: { caseId, purpose, status: { in: ["PROPOSED", "CHANGE_REQUESTED", "CONFIRMED"] } },
    orderBy: { updatedAt: "desc" },
  });
}

async function confirmRevision(
  tx: Prisma.TransactionClient,
  args: {
    caseId: string;
    appointmentId: string;
    revision: { id: string; method: "ONLINE" | "TELEPHONE" | "FACE_TO_FACE"; appointmentAtUtc: Date; timeZone: string; instructions: string; message: string | null };
    acceptedById: string;
    clientId: string;
    professionalUserId: string;
    purpose: "ASSESSMENT_CONSULTATION" | "FINAL_FILE_REVIEW" | "SUPPLEMENTARY_REQUEST";
    assessmentFee: Prisma.Decimal;
    assessmentPaymentExists: boolean;
  },
) {
  const now = new Date();
  await tx.caseAppointmentRevision.update({ where: { id: args.revision.id }, data: { acceptedAt: now, acceptedById: args.acceptedById } });
  await tx.caseAppointment.update({ where: { id: args.appointmentId }, data: {
    status: "CONFIRMED",
    method: args.revision.method,
    appointmentAtUtc: args.revision.appointmentAtUtc,
    timeZone: args.revision.timeZone,
    instructions: args.revision.instructions,
    professionalMessage: args.revision.message,
    confirmedAt: now,
    changeRequestedAt: null,
  } });
  const effect = appointmentConfirmationEffect(args.purpose, args.assessmentPaymentExists);
  if (effect.createAssessmentPayment) await tx.paymentRequest.create({ data: { caseId: args.caseId, stage: "ASSESSMENT", amount: args.assessmentFee } });
  if (effect.caseStatus) await tx.case.update({ where: { id: args.caseId }, data: { status: effect.caseStatus } });
  await tx.notification.createMany({ data: [
    { userId: args.clientId, caseId: args.caseId, appointmentId: args.appointmentId, type: "APPOINTMENT_CONFIRMED", title: "Appointment confirmed", message: "The appointment is confirmed. Assessment payment is now available where applicable." },
    { userId: args.professionalUserId, caseId: args.caseId, appointmentId: args.appointmentId, type: "APPOINTMENT_CONFIRMED", title: "Appointment confirmed", message: "The appointment agreement has been recorded." },
  ] });
  await tx.caseTimelineEvent.create({ data: { caseId: args.caseId, title: "Appointment confirmed", details: `${args.purpose.replaceAll("_", " ")} was mutually confirmed.` } });
}

export async function bookConfirmedAppointment(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const purpose = parseAppointmentPurpose(formData.get("purpose"));
  const confirmationSource = parseConfirmationSource(formData.get("confirmationSource"));
  if (!purpose || !confirmationSource) throw new Error("Select an appointment purpose and confirmation source.");
  const details = proposalFromForm(formData);
  const confirmationNote = String(formData.get("confirmationNote") ?? "").trim();
  const { user, record } = await appointmentCase(caseId);
  if (!canOfficiallyManageAppointment(user, record.professional.userId)) throw new Error("Assigned professional access required.");
  assertPurposeGate(record, purpose);
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const activeAppointment = await activeAppointmentInTransaction(tx, caseId, purpose);
    const appointmentData = { status: "CONFIRMED" as const, method: details.confirmedConsultationMethod, appointmentAtUtc: details.appointmentAtUtc, timeZone: details.appointmentTimeZone, instructions: details.appointmentInstructions, professionalMessage: details.professionalMessage, bookedById: user.id, confirmationSource, confirmationNote: confirmationNote || null, confirmedAt: now, changeRequestedAt: null };
    const appointment = activeAppointment
      ? await tx.caseAppointment.update({ where: { id: activeAppointment.id }, data: appointmentData })
      : await tx.caseAppointment.create({ data: { caseId, purpose, ...appointmentData } });
    await tx.caseAppointmentRevision.create({ data: { appointmentId: appointment.id, proposedById: user.id, method: details.confirmedConsultationMethod, appointmentAtUtc: details.appointmentAtUtc, timeZone: details.appointmentTimeZone, instructions: details.appointmentInstructions, message: details.professionalMessage, acceptedAt: now, acceptedById: user.id } });
    const effect = appointmentConfirmationEffect(purpose, record.payments.some((payment) => payment.stage === "ASSESSMENT"));
    if (effect.createAssessmentPayment) await tx.paymentRequest.create({ data: { caseId, stage: "ASSESSMENT", amount: record.service.assessmentFee } });
    if (effect.caseStatus) await tx.case.update({ where: { id: caseId }, data: { status: effect.caseStatus } });
    await tx.notification.create({ data: { userId: record.clientId, caseId, appointmentId: appointment.id, type: "APPOINTMENT_CONFIRMED", title: "Appointment confirmed", message: "Your confirmed appointment has been booked. Assessment payment is now available where applicable." } });
    await tx.caseTimelineEvent.create({ data: { caseId, title: "Confirmed appointment booked", details: `Client consent recorded via ${confirmationSource.replaceAll("_", " ")}.` } });
  });
  refreshCase(caseId);
}

export async function proposeAppointment(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const purpose = parseAppointmentPurpose(formData.get("purpose"));
  if (!purpose) throw new Error("Select an appointment purpose.");
  const details = proposalFromForm(formData);
  const { user, record } = await appointmentCase(caseId);
  if (!canOfficiallyManageAppointment(user, record.professional.userId)) throw new Error("Assigned professional access required.");
  assertPurposeGate(record, purpose);
  const currentActiveAppointment = activeAppointmentForPurpose(record.appointments, purpose);
  const revising = Boolean(currentActiveAppointment);
  await prisma.$transaction(async (tx) => {
    const activeAppointment = await activeAppointmentInTransaction(tx, caseId, purpose);
    const appointmentData = { status: "PROPOSED" as const, method: details.confirmedConsultationMethod, appointmentAtUtc: details.appointmentAtUtc, timeZone: details.appointmentTimeZone, instructions: details.appointmentInstructions, professionalMessage: details.professionalMessage, confirmedAt: null };
    const appointment = activeAppointment
      ? await tx.caseAppointment.update({ where: { id: activeAppointment.id }, data: appointmentData })
      : await tx.caseAppointment.create({ data: { caseId, purpose, ...appointmentData } });
    await tx.caseAppointmentRevision.create({ data: { appointmentId: appointment.id, proposedById: user.id, method: details.confirmedConsultationMethod, appointmentAtUtc: details.appointmentAtUtc, timeZone: details.appointmentTimeZone, instructions: details.appointmentInstructions, message: details.professionalMessage } });
    await tx.notification.create({ data: { userId: record.clientId, caseId, appointmentId: appointment.id, type: revising ? "APPOINTMENT_REVISED" : "APPOINTMENT_PROPOSED", title: revising ? "Appointment revised" : "Appointment proposed", message: "Review the proposed appointment in your case." } });
    await tx.caseTimelineEvent.create({ data: { caseId, title: revising ? "Appointment revised" : "Appointment proposed", details: purpose.replaceAll("_", " ") } });
  });
  refreshCase(caseId);
}

export async function counterproposeAppointment(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const details = proposalFromForm(formData);
  const { user, record } = await appointmentCase(caseId);
  if (!canClientManageAppointment(user, record.clientId)) throw new Error("Owning client access required.");
  const appointment = record.appointments.find((item) => item.id === appointmentId);
  if (!appointment || !["PROPOSED", "CHANGE_REQUESTED"].includes(appointment.status)) throw new Error("A counterproposal is not available.");
  await prisma.$transaction(async (tx) => {
    await tx.caseAppointment.update({ where: { id: appointmentId }, data: { status: "PROPOSED", method: details.confirmedConsultationMethod, appointmentAtUtc: details.appointmentAtUtc, timeZone: details.appointmentTimeZone, instructions: details.appointmentInstructions, professionalMessage: details.professionalMessage } });
    await tx.caseAppointmentRevision.create({ data: { appointmentId, proposedById: user.id, method: details.confirmedConsultationMethod, appointmentAtUtc: details.appointmentAtUtc, timeZone: details.appointmentTimeZone, instructions: details.appointmentInstructions, message: details.professionalMessage } });
    await tx.notification.create({ data: { userId: record.professional.userId, caseId, appointmentId, type: "APPOINTMENT_COUNTERPROPOSED", title: "Client proposed an appointment change", message: "Review the client's counterproposal." } });
    await tx.caseTimelineEvent.create({ data: { caseId, title: "Client proposed another appointment", details: "The professional must review the counterproposal." } });
  });
  refreshCase(caseId);
}

export async function acceptAppointmentProposal(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const { user, record } = await appointmentCase(caseId);
  const appointment = record.appointments.find((item) => item.id === appointmentId);
  const revision = appointment?.revisions[0];
  if (!appointment || !revision || appointment.status !== "PROPOSED") throw new Error("No appointment proposal is available.");
  const clientAccepting = canClientManageAppointment(user, record.clientId) && revision.proposedById === record.professional.userId;
  const professionalAccepting = canOfficiallyManageAppointment(user, record.professional.userId) && revision.proposedById === record.clientId;
  if (!clientAccepting && !professionalAccepting) throw new Error("You cannot accept this proposal.");
  await prisma.$transaction((tx) => confirmRevision(tx, { caseId, appointmentId, revision, acceptedById: user.id, clientId: record.clientId, professionalUserId: record.professional.userId, purpose: appointment.purpose, assessmentFee: record.service.assessmentFee, assessmentPaymentExists: record.payments.some((payment) => payment.stage === "ASSESSMENT") }));
  refreshCase(caseId);
}

export async function requestAppointmentChange(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const reason = String(formData.get("message") ?? "").trim();
  if (!reason) throw new Error("Provide a reason for the requested change.");
  const { user, record } = await appointmentCase(caseId);
  const appointment = record.appointments.find((item) => item.id === appointmentId);
  if (!appointment || appointment.status !== "CONFIRMED") throw new Error("This appointment cannot be changed now.");
  const professional = canOfficiallyManageAppointment(user, record.professional.userId);
  const client = canClientManageAppointment(user, record.clientId);
  if (!professional && !client) throw new Error("Appointment access denied.");
  const recipientId = client ? record.professional.userId : record.clientId;
  await prisma.$transaction([
    prisma.caseAppointment.update({ where: { id: appointmentId }, data: { status: "CHANGE_REQUESTED", changeRequestedAt: new Date() } }),
    prisma.caseAppointmentMessage.create({ data: { appointmentId, authorId: user.id, kind: "CHANGE_REQUEST", body: reason } }),
    prisma.notification.create({ data: { userId: recipientId, caseId, appointmentId, type: "APPOINTMENT_CHANGE_REQUESTED", title: "Appointment change requested", message: reason } }),
    prisma.caseTimelineEvent.create({ data: { caseId, title: "Appointment change requested", details: reason } }),
  ]);
  refreshCase(caseId);
}

export async function addAppointmentMessage(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const body = String(formData.get("message") ?? "").trim();
  if (!body) throw new Error("Enter an appointment message.");
  const { user, record } = await appointmentCase(caseId);
  const appointment = record.appointments.find((item) => item.id === appointmentId);
  if (!appointment || appointment.status === "WITHDRAWN" || appointment.status === "CANCELLED") throw new Error("Appointment messaging is unavailable.");
  const professional = canOfficiallyManageAppointment(user, record.professional.userId);
  const client = canClientManageAppointment(user, record.clientId);
  if (!professional && !client) throw new Error("Appointment access denied.");
  await prisma.$transaction([
    prisma.caseAppointmentMessage.create({ data: { appointmentId, authorId: user.id, body } }),
    prisma.notification.create({ data: { userId: client ? record.professional.userId : record.clientId, caseId, appointmentId, type: "APPOINTMENT_MESSAGE", title: "New appointment message", message: body } }),
  ]);
  refreshCase(caseId);
}

export async function withdrawAssessmentRequest(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const { user, record } = await appointmentCase(caseId);
  if (!canClientManageAppointment(user, record.clientId) || !canWithdrawAssessment(record.status, record.payments.some((payment) => payment.stage === "ASSESSMENT" && payment.status === "PAID"))) throw new Error("This assessment request cannot be withdrawn.");
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const activeAppointment = await activeAppointmentInTransaction(tx, caseId, "ASSESSMENT_CONSULTATION");
    const appointment = activeAppointment
      ? await tx.caseAppointment.update({ where: { id: activeAppointment.id }, data: { status: "WITHDRAWN", withdrawnAt: now, withdrawalReason: reason || null } })
      : await tx.caseAppointment.create({ data: { caseId, purpose: "ASSESSMENT_CONSULTATION", status: "WITHDRAWN", withdrawnAt: now, withdrawalReason: reason || null } });
    await tx.caseAppointmentMessage.create({ data: { appointmentId: appointment.id, authorId: user.id, kind: "WITHDRAWAL", body: reason || "Assessment request withdrawn by client." } });
    await tx.paymentRequest.updateMany({ where: { caseId, stage: "ASSESSMENT", status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.case.update({ where: { id: caseId }, data: { status: "ASSESSMENT_REQUEST_WITHDRAWN", completedAt: now } });
    await tx.notification.create({ data: { userId: record.professional.userId, caseId, appointmentId: appointment.id, type: "ASSESSMENT_WITHDRAWN", title: "Assessment request withdrawn", message: reason || "The client withdrew the assessment request." } });
    await tx.caseTimelineEvent.create({ data: { caseId, title: "Assessment request withdrawn", details: reason || "The client withdrew before assessment payment." } });
  });
  refreshCase(caseId);
}

export async function markNotificationRead(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "");
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  await prisma.notification.updateMany({ where: { id: notificationId, userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/dashboard");
  revalidatePath("/professional");
}
