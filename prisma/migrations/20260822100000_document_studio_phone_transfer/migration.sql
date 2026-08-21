CREATE TABLE "DocumentStudioTransferSession" ("id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "userId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DocumentStudioTransferSession_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DocumentStudioTransferItem" ("id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "size" INTEGER NOT NULL, "storageKey" TEXT NOT NULL, "position" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DocumentStudioTransferItem_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DocumentStudioTransferSession_tokenHash_key" ON "DocumentStudioTransferSession"("tokenHash");
CREATE UNIQUE INDEX "DocumentStudioTransferItem_storageKey_key" ON "DocumentStudioTransferItem"("storageKey");
CREATE INDEX "DocumentStudioTransferSession_expiresAt_revokedAt_idx" ON "DocumentStudioTransferSession"("expiresAt", "revokedAt");
CREATE INDEX "DocumentStudioTransferSession_userId_idx" ON "DocumentStudioTransferSession"("userId");
CREATE INDEX "DocumentStudioTransferItem_sessionId_position_idx" ON "DocumentStudioTransferItem"("sessionId", "position");
ALTER TABLE "DocumentStudioTransferSession" ADD CONSTRAINT "DocumentStudioTransferSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentStudioTransferItem" ADD CONSTRAINT "DocumentStudioTransferItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DocumentStudioTransferSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
