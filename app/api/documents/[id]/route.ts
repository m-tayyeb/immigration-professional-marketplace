import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { documentStorage } from "../../../../lib/document-storage";
import { documentAccessWhere } from "../../../../lib/document-access";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const document = await prisma.caseDocument.findFirst({
    where: documentAccessWhere(id, session.user),
  });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const stored = await documentStorage().read(document.storageKey);
    if (!stored) return NextResponse.json({ error: "This historical document file is unavailable." }, { status: 404 });
    return new NextResponse(stored.body, { headers: { "Content-Type": stored.contentType || document.mimeType, "Content-Disposition": `attachment; filename="${document.fileName.replaceAll('"', '')}"`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }
}
