import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { documentStorage, storeDocumentWithRollback } from "../../../../../../lib/document-storage";
import { hashTransferToken, transferBatchPositions, transferFileError, transferSessionError } from "../../../../../../lib/document-studio-transfer";

const sessionStatus = { SESSION_NOT_FOUND: 404, SESSION_EXPIRED: 410, SESSION_REVOKED: 410 } as const;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await prisma.documentStudioTransferSession.findUnique({ where: { tokenHash: hashTransferToken(token) }, include: { items: true } });
  const sessionError = transferSessionError(session);
  if (sessionError) return NextResponse.json({ code: sessionError, error: "This transfer session is unavailable." }, { status: sessionStatus[sessionError] });
  if (!session) return NextResponse.json({ code: "SESSION_NOT_FOUND", error: "This transfer session is unavailable." }, { status: 404 });

  let batch: FormDataEntryValue[];
  try { const form = await request.formData(); batch = [...form.getAll("files"), ...form.getAll("file")]; }
  catch { return NextResponse.json({ code: "UPLOAD_FAILED", error: "The pages could not be uploaded." }, { status: 400 }); }
  if (!batch.length || batch.some((entry) => !(entry instanceof File))) return NextResponse.json({ code: "UNSUPPORTED_FILE_TYPE", error: "Use PDF, JPG, or PNG pages." }, { status: 400 });
  const files = batch as File[];
  const fileError = files.map(transferFileError).find(Boolean);
  if (fileError) return NextResponse.json({ code: fileError, error: fileError === "FILE_TOO_LARGE" ? "A page is too large." : "Use PDF, JPG, or PNG pages." }, { status: fileError === "FILE_TOO_LARGE" ? 413 : 400 });

  const positions = transferBatchPositions(session.items, files.length);
  const created: { id: string; storageKey: string }[] = [];
  const storage = documentStorage();
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]; const name = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_"); const key = `document-studio-transfer/${session.id}/${randomUUID()}-${name}`;
      const item = await storeDocumentWithRollback({ storage, key, contents: Buffer.from(await file.arrayBuffer()), contentType: file.type, commit: (storageKey) => prisma.documentStudioTransferItem.create({ data: { sessionId: session.id, fileName: name, mimeType: file.type, size: file.size, storageKey, position: positions[index] } }) });
      created.push({ id: item.id, storageKey: item.storageKey });
    }
    return NextResponse.json({ ok: true, count: files.length });
  } catch {
    await Promise.allSettled([...created.map((item) => storage.delete(item.storageKey)), ...(created.length ? [prisma.documentStudioTransferItem.deleteMany({ where: { id: { in: created.map((item) => item.id) } } })] : [])]);
    return NextResponse.json({ code: "UPLOAD_FAILED", error: "The pages could not be uploaded." }, { status: 500 });
  }
}
