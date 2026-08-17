"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../auth";
import { canConfirmDocumentCollection, canManageCaseDocuments, canMarkFileReady, outstandingDocuments, reminderAllowed, statusAfterRequirementUpload, uploadActorForRole } from "./document-workflow";
import { caseAccessWhere } from "./professional-assignment";
import { prisma } from "./prisma";

async function documentCase(caseId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const record = await prisma.case.findFirst({ where: caseAccessWhere(caseId, session.user), include: { professional: true, documentRequirements: true, documentCompletion: true, documentReminders: { orderBy: { sentAt: "desc" }, take: 1 }, payments: true, serviceDecision: true } });
  if (!record) throw new Error("Case not found or access denied.");
  return { user: session.user, record };
}

function requireProfessional(user: { id: string; role: "CLIENT" | "PROFESSIONAL" | "ADMIN" }, professionalUserId: string) {
  if (!canManageCaseDocuments(user, professionalUserId)) throw new Error("Assigned professional or administrator access required.");
}

function refresh(caseId: string) {
  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/professional/cases/${caseId}`);
}

export async function createDocumentRequirement(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const { user, record } = await documentCase(caseId);
  requireProfessional(user, record.professional.userId);
  if (!title || record.serviceDecision?.decision !== "PROCEED") throw new Error("A binding Proceed decision and requirement title are required.");
  await prisma.$transaction([
    prisma.caseDocumentRequirement.create({ data: { caseId, title, description: description || null } }),
    prisma.notification.create({ data: { userId: record.clientId, caseId, type: "DOCUMENTS_REQUIRED", title: "Documents required", message: `A new document is required: ${title}` } }),
    prisma.caseTimelineEvent.create({ data: { caseId, title: "Document requested", details: title } }),
  ]);
  refresh(caseId);
}

export async function uploadRequirementDocument(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const requirementId = String(formData.get("requirementId") ?? "");
  const file = formData.get("file");
  const { user, record } = await documentCase(caseId);
  const requirement = record.documentRequirements.find((item) => item.id === requirementId && item.active);
  if (!requirement) throw new Error("Active document requirement not found.");
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) throw new Error("Choose a file up to 10 MB.");
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${caseId}/${randomUUID()}-${safeName}`;
  const fullPath = path.join(process.cwd(), ".private-uploads", storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));
  const actor = uploadActorForRole(user.role);
  const externalSourceNote = actor === "PROFESSIONAL" ? String(formData.get("externalSourceNote") ?? "").trim() : "";
  await prisma.$transaction([
    prisma.caseDocument.create({ data: { caseId, requirementId, uploadedById: user.id, uploadActor: actor, externalSourceNote: externalSourceNote || null, folder: "CLIENT", fileName: safeName, storageKey, mimeType: file.type || "application/octet-stream", size: file.size } }),
    prisma.caseDocumentRequirement.update({ where: { id: requirementId }, data: { status: statusAfterRequirementUpload(requirement.status) } }),
    prisma.notification.create({ data: { userId: actor === "CLIENT" ? record.professional.userId : record.clientId, caseId, type: "DOCUMENT_RECEIVED", title: "Document received", message: `${requirement.title} was uploaded by the ${actor.toLowerCase()}.` } }),
  ]);
  refresh(caseId);
}

export async function reviewRequirementDocument(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const requirementId = String(formData.get("requirementId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const { user, record } = await documentCase(caseId);
  requireProfessional(user, record.professional.userId);
  const requirement = record.documentRequirements.find((item) => item.id === requirementId && item.active);
  if (!requirement || requirement.status !== "RECEIVED" || !["ACCEPTED", "REPLACEMENT_REQUIRED"].includes(decision)) throw new Error("This document cannot be reviewed in that way.");
  await prisma.$transaction([
    prisma.caseDocumentRequirement.update({ where: { id: requirementId }, data: { status: decision as "ACCEPTED" | "REPLACEMENT_REQUIRED" } }),
    prisma.notification.create({ data: { userId: record.clientId, caseId, type: decision === "ACCEPTED" ? "DOCUMENT_ACCEPTED" : "DOCUMENT_REPLACEMENT_REQUIRED", title: decision === "ACCEPTED" ? "Document accepted" : "Replacement document required", message: requirement.title } }),
  ]);
  refresh(caseId);
}

export async function sendDocumentReminder(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const { user, record } = await documentCase(caseId);
  requireProfessional(user, record.professional.userId);
  const now = new Date();
  if (!outstandingDocuments(record.documentRequirements) || !reminderAllowed(record.documentReminders[0]?.sentAt ?? null, now)) throw new Error("No reminder is currently available.");
  const dedupeKey = `${caseId}:${Math.floor(now.getTime() / (5 * 60_000))}`;
  try {
    await prisma.$transaction([
      prisma.caseDocumentReminder.create({ data: { caseId, sentById: user.id, sentAt: now, dedupeKey } }),
      prisma.notification.create({ data: { userId: record.clientId, caseId, type: "DOCUMENT_REMINDER", title: "Document reminder", message: "Please upload or replace the outstanding documents for your case." } }),
      prisma.caseTimelineEvent.create({ data: { caseId, title: "Document reminder sent", visibleToClient: true } }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("A document reminder was sent recently.");
    throw error;
  }
  refresh(caseId);
}

export async function confirmDocumentCollection(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const { user, record } = await documentCase(caseId);
  requireProfessional(user, record.professional.userId);
  if (record.documentCompletion || !canConfirmDocumentCollection(record.documentRequirements)) throw new Error("Every active requirement must be accepted and completion must not already exist.");
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.caseDocumentRequirement.findMany({ where: { caseId, active: true }, select: { active: true, status: true } });
      if (!canConfirmDocumentCollection(current)) throw new Error("Every active requirement must be accepted.");
      await tx.caseDocumentCompletion.create({ data: { caseId, confirmedById: user.id, confirmedAt: now } });
      await tx.caseChecklistItem.updateMany({ where: { caseId, title: "Requested client documents received" }, data: { completedAt: now } });
      await tx.caseTimelineEvent.create({ data: { caseId, title: "All required documents confirmed received", details: "Every active requirement was accepted by the professional." } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("Document completion was already confirmed.");
    throw error;
  }
  refresh(caseId);
}

export async function markFileReady(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const { user, record } = await documentCase(caseId);
  requireProfessional(user, record.professional.userId);
  const paid = record.payments.some((item) => item.stage === "REMAINING_BALANCE" && item.status === "PAID");
  if (!canMarkFileReady(paid, Boolean(record.fileReadyAt))) throw new Error("The remaining payment must be paid before the file can be marked ready.");
  const now = new Date();
  const updated = await prisma.case.updateMany({ where: { id: caseId, fileReadyAt: null }, data: { fileReadyAt: now, fileReadyById: user.id, status: "FILE_READY_FOR_REVIEW" } });
  if (updated.count !== 1) throw new Error("The file is already ready.");
  await prisma.$transaction([
    prisma.notification.create({ data: { userId: record.clientId, caseId, type: "FILE_READY", title: "File ready for final review", message: "The professional can now propose the final file review appointment." } }),
    prisma.caseTimelineEvent.create({ data: { caseId, title: "File ready for final review" } }),
  ]);
  refresh(caseId);
}
