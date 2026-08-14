import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const document = await prisma.caseDocument.findFirst({
    where: {
      id,
      ...(session.user.role === "CLIENT"
        ? { case: { clientId: session.user.id }, OR: [{ folder: "CLIENT" }, { folder: "PROFESSIONAL", releasedToClientAt: { not: null } }] }
        : session.user.role === "PROFESSIONAL" ? { case: { professional: { userId: session.user.id } } } : {}),
    },
  });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const root = path.resolve(process.cwd(), ".private-uploads");
  const filePath = path.resolve(root, document.storageKey);
  if (!filePath.startsWith(`${root}${path.sep}`)) return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  try {
    const contents = await readFile(filePath);
    return new NextResponse(contents, { headers: { "Content-Type": document.mimeType, "Content-Disposition": `attachment; filename="${document.fileName.replaceAll('"', '')}"`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }
}
