"use server";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../auth";
import { hasDocumentStudioEntitlement, validateStudioFile } from "./document-studio";
import { documentStorage, storeDocumentWithRollback } from "./document-storage";
import { prisma } from "./prisma";

export async function saveStudioDocument(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const caseId = String(formData.get("caseId") ?? ""); const file = formData.get("file");
  const caseWhere = session.user.role === "CLIENT" ? { id: caseId, clientId: session.user.id } : session.user.role === "PROFESSIONAL" ? { id: caseId, professional: { userId: session.user.id } } : { id: caseId };
  const [caseRecord, payments] = await Promise.all([prisma.case.findFirst({ where: caseWhere }), session.user.role === "CLIENT" ? prisma.paymentRequest.findMany({ where: { case: { clientId: session.user.id } }, select: { stage: true, status: true } }) : Promise.resolve([])]);
  if (!caseRecord || (session.user.role === "CLIENT" && !hasDocumentStudioEntitlement(payments))) throw new Error("Document Studio is not available for this account or case.");
  if (!(file instanceof File) || !validateStudioFile(file)) throw new Error("Use a PDF, JPG, or PNG up to 10 MB.");
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_"); const key = `${caseId}/studio-${randomUUID()}-${safeName}`; const mimeType = file.type;
  const professional = session.user.role !== "CLIENT";
  await storeDocumentWithRollback({ storage: documentStorage(), key, contents: Buffer.from(await file.arrayBuffer()), contentType: mimeType, commit: (storageKey) => prisma.caseDocument.create({ data: { caseId, uploadedById: session.user.id, uploadActor: professional ? "PROFESSIONAL" : "CLIENT", folder: professional ? "PROFESSIONAL" : "CLIENT", fileName: safeName, storageKey, mimeType, size: file.size } }) });
  revalidatePath(`/cases/${caseId}`); revalidatePath("/dashboard");
}
