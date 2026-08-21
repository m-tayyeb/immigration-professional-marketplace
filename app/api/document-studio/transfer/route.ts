import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { hashTransferToken, newTransferToken, transferLifetimeMs } from "../../../../lib/document-studio-transfer";
export async function POST() { const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const token = newTransferToken(); await prisma.documentStudioTransferSession.create({ data: { tokenHash: hashTransferToken(token), userId: session.user.id, expiresAt: new Date(Date.now() + transferLifetimeMs) } }); return NextResponse.json({ token, expiresInSeconds: transferLifetimeMs / 1000 }); }
