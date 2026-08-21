"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { auth } from "../auth";
import { canManageCaseDocuments } from "./document-workflow";
import { canAddSupplement, canCompleteCase, canRecordMainSubmission, canRecordMigriDecision, canSubmitSupplementaryResponse } from "./phase-five-workflow";
import { caseAccessWhere } from "./professional-assignment";
import { prisma } from "./prisma";
import { documentStorage, storeDocumentWithRollback } from "./document-storage";

async function phaseFiveCase(caseId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const record = await prisma.case.findFirst({ where: caseAccessWhere(caseId, session.user), include: { professional: true, payments: true, appointments: true } });
  if (!record) throw new Error("Case not found or access denied.");
  const professional = canManageCaseDocuments(session.user, record.professional.userId);
  return { user: session.user, record, professional };
}
function refresh(caseId: string) { revalidatePath(`/cases/${caseId}`); revalidatePath(`/professional/cases/${caseId}`); revalidatePath("/dashboard"); revalidatePath("/professional"); }
const string = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function recordMainSubmission(formData: FormData) {
  const caseId = string(formData, "caseId"); const { user, record, professional } = await phaseFiveCase(caseId);
  const [existing, decision] = await Promise.all([prisma.caseSubmission.findUnique({ where: { caseId } }), prisma.migriDecision.findUnique({ where: { caseId } })]);
  const remainingPaid = record.payments.some((payment) => payment.stage === "REMAINING_BALANCE" && payment.status === "PAID");
  const finalReviewExists = record.appointments.some((appointment) => appointment.purpose === "FINAL_FILE_REVIEW");
  const checklist = ["finalFileReviewed", "signaturesCompleted", "clientLoggedIn", "documentsUploaded", "applicationReviewed", "submitted"].map((key) => ({ key, completed: formData.get(key) === "on" }));
  if (!canRecordMainSubmission({ remainingPaid, fileReady: Boolean(record.fileReadyAt), finalReviewExists, alreadySubmitted: Boolean(existing || decision), professional }) || checklist.some((item) => !item.completed)) throw new Error("A paid, file-ready case with a final review and completed submission checklist is required.");
  try { await prisma.$transaction([prisma.caseSubmission.create({ data: { caseId, submittedById: user.id, checklist, referenceNumber: string(formData, "referenceNumber") || null, note: string(formData, "note") || null } }), prisma.case.update({ where: { id: caseId }, data: { status: "AWAITING_MIGRI" } }), prisma.caseTimelineEvent.create({ data: { caseId, title: "Application submitted to Enter Finland" } }), prisma.notification.create({ data: { userId: record.clientId, caseId, type: "MIGRI_SUBMISSION", title: "Application submitted", message: "Your application was recorded as submitted to Enter Finland." } })]); } catch { throw new Error("This application submission was already recorded."); }
  refresh(caseId);
}

export async function addMigriSupplementaryRequest(formData: FormData) {
  const caseId = string(formData, "caseId"); const { user, record } = await phaseFiveCase(caseId);
  const file = formData.get("file");
  const [submission, decision] = await Promise.all([prisma.caseSubmission.findUnique({ where: { caseId } }), prisma.migriDecision.findUnique({ where: { caseId } })]);
  if (!canAddSupplement({ mainSubmitted: Boolean(submission), decisionExists: Boolean(decision) })) throw new Error("Supplementary requests are unavailable after a decision or before submission.");
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) throw new Error("Upload the Migri supplementary request document (maximum 10 MB).");
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_"); const storageKey = `${caseId}/${randomUUID()}-${safeName}`; const uploadActor = user.role === "CLIENT" ? "CLIENT" as const : "PROFESSIONAL" as const;
  await storeDocumentWithRollback({ storage: documentStorage(), key: storageKey, contents: Buffer.from(await file.arrayBuffer()), contentType: file.type || "application/octet-stream", commit: (storedKey) => prisma.$transaction(async (tx) => { const request = await tx.migriSupplementaryRequest.create({ data: { caseId, createdById: user.id, deadline: string(formData, "deadline") ? new Date(string(formData, "deadline")) : null, note: string(formData, "note") || null } }); await tx.caseDocument.create({ data: { caseId, supplementaryRequestId: request.id, uploadedById: user.id, uploadActor, folder: "CLIENT", fileName: safeName, storageKey: storedKey, mimeType: file.type || "application/octet-stream", size: file.size } }); await tx.notification.create({ data: { userId: record.professional.userId, caseId, type: "MIGRI_SUPPLEMENT", title: "Migri supplementary request", message: "A new Migri request was added for review." } }); }) });
  refresh(caseId);
}

export async function uploadMigriDecisionDocument(formData: FormData) {
  const caseId = string(formData, "caseId"); const { user } = await phaseFiveCase(caseId); const file = formData.get("file");
  const [submission, decision] = await Promise.all([prisma.caseSubmission.findUnique({ where: { caseId } }), prisma.migriDecision.findUnique({ where: { caseId } })]);
  if (!submission || decision) throw new Error("A decision document can be reported only after submission and before an official decision.");
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) throw new Error("Upload the Migri decision document (maximum 10 MB).");
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_"); const storageKey = `${caseId}/${randomUUID()}-${safeName}`; const uploadActor = user.role === "CLIENT" ? "CLIENT" as const : "PROFESSIONAL" as const;
  await storeDocumentWithRollback({ storage: documentStorage(), key: storageKey, contents: Buffer.from(await file.arrayBuffer()), contentType: file.type || "application/octet-stream", commit: (storedKey) => prisma.caseDocument.create({ data: { caseId, uploadedById: user.id, uploadActor, folder: "CLIENT", fileName: safeName, storageKey: storedKey, mimeType: file.type || "application/octet-stream", size: file.size, migriDecisionReport: true } }) }); refresh(caseId);
}

export async function createSupplementaryRequirement(formData: FormData) {
  const caseId = string(formData, "caseId"), supplementaryRequestId = string(formData, "supplementaryRequestId"), title = string(formData, "title"); const { user, record, professional } = await phaseFiveCase(caseId);
  const request = await prisma.migriSupplementaryRequest.findFirst({ where: { id: supplementaryRequestId, caseId } }); const decision = await prisma.migriDecision.findUnique({ where: { caseId } });
  if (!professional || !request || decision || !title) throw new Error("Only the assigned professional can add requirements for an open Migri request.");
  await prisma.$transaction([prisma.caseDocumentRequirement.create({ data: { caseId, supplementaryRequestId, title, description: string(formData, "description") || null } }), prisma.notification.create({ data: { userId: record.clientId, caseId, type: "MIGRI_DOCUMENTS_REQUIRED", title: "Migri documents required", message: `Migri request: ${title}` } })]); refresh(caseId);
}

export async function submitSupplementaryResponse(formData: FormData) {
  const caseId = string(formData, "caseId"), supplementaryRequestId = string(formData, "supplementaryRequestId"); const { user, professional } = await phaseFiveCase(caseId);
  const [decision, response, requirements] = await Promise.all([prisma.migriDecision.findUnique({ where: { caseId } }), prisma.migriSupplementaryResponse.findUnique({ where: { supplementaryRequestId } }), prisma.caseDocumentRequirement.findMany({ where: { caseId, supplementaryRequestId }, select: { active: true, status: true } })]);
  if (!canSubmitSupplementaryResponse({ professional, decisionExists: Boolean(decision), alreadySubmitted: Boolean(response), requirements })) throw new Error("Every requirement in this Migri request must be accepted before submission.");
  await prisma.$transaction([prisma.migriSupplementaryResponse.create({ data: { supplementaryRequestId, submittedById: user.id, referenceNumber: string(formData, "referenceNumber") || null, note: string(formData, "note") || null } }), prisma.case.update({ where: { id: caseId }, data: { status: "AWAITING_MIGRI" } }), prisma.caseTimelineEvent.create({ data: { caseId, title: "Supplementary response submitted" } })]); refresh(caseId);
}

export async function recordMigriDecision(formData: FormData) {
  const caseId = string(formData, "caseId"), outcome = string(formData, "outcome"), decisionDocumentId = string(formData, "decisionDocumentId"); const { user, record, professional } = await phaseFiveCase(caseId); const [submission, decision, document] = await Promise.all([prisma.caseSubmission.findUnique({ where: { caseId } }), prisma.migriDecision.findUnique({ where: { caseId } }), prisma.caseDocument.findFirst({ where: { id: decisionDocumentId, caseId, migriDecisionReport: true, migriDecisionId: null } })]);
  if (!canRecordMigriDecision({ professional, mainSubmitted: Boolean(submission), decisionExists: Boolean(decision), hasDecisionDocument: Boolean(document) }) || !["POSITIVE", "NEGATIVE", "OTHER"].includes(outcome)) throw new Error("An authorized professional must select an uploaded Migri decision document and record one official decision.");
  if (!document) throw new Error("Select an uploaded Migri decision document.");
  const documentId = document.id;
  try { await prisma.$transaction(async (tx) => { const recorded = await tx.migriDecision.create({ data: { caseId, outcome: outcome as "POSITIVE" | "NEGATIVE" | "OTHER", decisionDate: new Date(), recordedById: user.id, referenceNumber: string(formData, "referenceNumber") || null, note: string(formData, "note") || null } }); await tx.caseDocument.update({ where: { id: documentId }, data: { migriDecisionId: recorded.id } }); await tx.case.update({ where: { id: caseId }, data: { status: "DECISION_RECEIVED" } }); await tx.caseTimelineEvent.create({ data: { caseId, title: "Official Migri decision recorded" } }); await tx.notification.create({ data: { userId: record.clientId, caseId, type: "MIGRI_DECISION", title: "Migri decision received", message: "Your professional recorded the official Migri decision." } }); }); } catch { throw new Error("An official decision has already been recorded."); } refresh(caseId);
}

export async function completeCaseAfterDecision(formData: FormData) {
  const caseId = string(formData, "caseId"); const { user, record, professional } = await phaseFiveCase(caseId); const [decision, completion] = await Promise.all([prisma.migriDecision.findUnique({ where: { caseId } }), prisma.caseCompletion.findUnique({ where: { caseId } })]);
  if (!canCompleteCase({ professional, decisionExists: Boolean(decision), completed: Boolean(completion) })) throw new Error("An authorized professional can complete a case only after its decision.");
  try { await prisma.$transaction([prisma.caseCompletion.create({ data: { caseId, completedById: user.id, closingNote: string(formData, "closingNote") || null } }), prisma.case.update({ where: { id: caseId }, data: { status: "COMPLETED", completedAt: new Date() } }), prisma.caseTimelineEvent.create({ data: { caseId, title: "Case completed" } }), prisma.notification.create({ data: { userId: record.clientId, caseId, type: "CASE_COMPLETED", title: "Case completed", message: "Your CaseWiser case has been completed." } })]); } catch { throw new Error("This case has already been completed."); } refresh(caseId);
}
