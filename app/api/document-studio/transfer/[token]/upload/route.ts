import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { documentStorage } from "../../../../../../lib/document-storage";
import { existingTransferPage, hashTransferToken, transferBatchPositions, transferFileError, transferSessionError } from "../../../../../../lib/document-studio-transfer";

const sessionStatus = { SESSION_NOT_FOUND: 404, SESSION_EXPIRED: 410, SESSION_REVOKED: 410 } as const;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const requestId = randomUUID().slice(0, 12); const contentLength = Number(request.headers.get("content-length") ?? 0) || null;
  console.info("[document-studio-upload] route-entered", { requestId, contentLength });
  const { token } = await params;
  const session = await prisma.documentStudioTransferSession.findUnique({ where: { tokenHash: hashTransferToken(token) }, include: { items: true } });
  const sessionError = transferSessionError(session);
  if (sessionError) { console.warn("[document-studio-upload] session-rejected", { requestId, code: sessionError }); return NextResponse.json({ code: sessionError, error: "This transfer session is unavailable.", requestId }, { status: sessionStatus[sessionError] }); }
  if (!session) return NextResponse.json({ code: "SESSION_NOT_FOUND", error: "This transfer session is unavailable.", requestId }, { status: 404 });

  let form: FormData;
  try { form = await request.formData(); }
  catch (error) { console.error("[document-studio-upload] form-data-failed", { requestId, errorName: error instanceof Error ? error.name : "UnknownError" }); return NextResponse.json({ code: "UPLOAD_FAILED", error: "The page could not be uploaded.", requestId }, { status: 400 }); }
  const batch = [...form.getAll("files"), ...form.getAll("file")];
  if (!batch.length || batch.some((entry) => !(entry instanceof File))) { console.warn("[document-studio-upload] invalid-form-data", { requestId, fileCount: batch.length }); return NextResponse.json({ code: "UNSUPPORTED_FILE_TYPE", error: "Use a PDF, JPG, or PNG page.", requestId }, { status: 400 }); }
  const files = batch as File[]; const combinedSize = files.reduce((sum, file) => sum + file.size, 0);
  console.info("[document-studio-upload] form-data-parsed", { requestId, fileCount: files.length, combinedSize, files: files.map((file) => ({ mimeType: file.type || "unknown", size: file.size })) });
  const fileError = files.map(transferFileError).find(Boolean);
  if (fileError) { console.warn("[document-studio-upload] file-rejected", { requestId, code: fileError }); return NextResponse.json({ code: fileError, error: fileError === "FILE_TOO_LARGE" ? "The page is too large." : "Use a PDF, JPG, or PNG page.", requestId }, { status: fileError === "FILE_TOO_LARGE" ? 413 : 400 }); }

  const requestedPosition = files.length === 1 && /^\d+$/.test(String(form.get("position") ?? "")) ? Number(form.get("position")) : null;
  const positions = requestedPosition === null ? transferBatchPositions(session.items, files.length) : [requestedPosition];
  const created: { id: string; storageKey: string }[] = []; const storage = documentStorage();
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]; const name = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_"); const position = positions[index];
      const duplicate = existingTransferPage(session.items, position, name);
      if (duplicate) { console.info("[document-studio-upload] idempotent-retry", { requestId, position }); continue; }
      if (session.items.some((item) => item.position === position)) throw new Error("PAGE_POSITION_CONFLICT");
      const key = `document-studio-transfer/${session.id}/${randomUUID()}-${name}`; let storedKey: string;
      try { storedKey = (await storage.store(key, Buffer.from(await file.arrayBuffer()), file.type)).key; }
      catch (error) { console.error("[document-studio-upload] blob-store-failed", { requestId, position, errorName: error instanceof Error ? error.name : "UnknownError" }); throw error; }
      try { const item = await prisma.documentStudioTransferItem.create({ data: { sessionId: session.id, fileName: name, mimeType: file.type, size: file.size, storageKey: storedKey, position } }); created.push({ id: item.id, storageKey: item.storageKey }); }
      catch (error) { const rollback = await Promise.allSettled([storage.delete(storedKey)]); console.error("[document-studio-upload] prisma-create-failed", { requestId, position, rollbackTriggered: true, rollbackSucceeded: rollback[0].status === "fulfilled", errorName: error instanceof Error ? error.name : "UnknownError" }); throw error; }
    }
    console.info("[document-studio-upload] upload-complete", { requestId, fileCount: files.length, positions });
    return NextResponse.json({ ok: true, count: files.length, requestId });
  } catch (error) {
    const rollback = await Promise.allSettled([...created.map((item) => storage.delete(item.storageKey)), ...(created.length ? [prisma.documentStudioTransferItem.deleteMany({ where: { id: { in: created.map((item) => item.id) } } })] : [])]);
    console.error("[document-studio-upload] upload-failed", { requestId, code: "UPLOAD_FAILED", rollbackTriggered: created.length > 0, rollbackFailures: rollback.filter((result) => result.status === "rejected").length, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ code: "UPLOAD_FAILED", error: "The page could not be uploaded.", requestId }, { status: 500 });
  }
}
