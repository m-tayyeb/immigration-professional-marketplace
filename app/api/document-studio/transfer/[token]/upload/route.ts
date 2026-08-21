import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { validateStudioFile } from "../../../../../../lib/document-studio";
import { documentStorage, storeDocumentWithRollback } from "../../../../../../lib/document-storage";
import { hashTransferToken, transferIsActive } from "../../../../../../lib/document-studio-transfer";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) { const { token } = await params; const session = await prisma.documentStudioTransferSession.findUnique({ where: { tokenHash: hashTransferToken(token) }, include: { items: true } }); if (!session || !transferIsActive(session)) return NextResponse.json({ error: "This transfer session is unavailable." }, { status: 404 }); const form = await request.formData(); const file = form.get("file"); if (!(file instanceof File) || !validateStudioFile(file)) return NextResponse.json({ error: "Use a PDF, JPG, or PNG up to 10 MB." }, { status: 400 }); const name = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_"); const key = `document-studio-transfer/${session.id}/${randomUUID()}-${name}`; await storeDocumentWithRollback({ storage: documentStorage(), key, contents: Buffer.from(await file.arrayBuffer()), contentType: file.type, commit: (storageKey) => prisma.documentStudioTransferItem.create({ data: { sessionId: session.id, fileName: name, mimeType: file.type, size: file.size, storageKey, position: session.items.length } }) }); return NextResponse.json({ ok: true }); }
