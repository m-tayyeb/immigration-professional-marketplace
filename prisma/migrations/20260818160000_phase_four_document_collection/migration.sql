CREATE TYPE "DocumentRequirementStatus" AS ENUM ('REQUESTED', 'RECEIVED', 'ACCEPTED', 'REPLACEMENT_REQUIRED');
CREATE TYPE "DocumentUploadActor" AS ENUM ('CLIENT', 'PROFESSIONAL');

ALTER TYPE "CaseStatus" ADD VALUE 'FILE_PREPARATION';
ALTER TYPE "CaseStatus" ADD VALUE 'FILE_READY_FOR_REVIEW';

ALTER TABLE "Case"
  ADD COLUMN "fileReadyAt" TIMESTAMP(3),
  ADD COLUMN "fileReadyById" TEXT;

ALTER TABLE "CaseDocument"
  ADD COLUMN "requirementId" TEXT,
  ADD COLUMN "uploadActor" "DocumentUploadActor",
  ADD COLUMN "externalSourceNote" TEXT;

CREATE TABLE "CaseDocumentRequirement" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "DocumentRequirementStatus" NOT NULL DEFAULT 'REQUESTED',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaseDocumentRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseDocumentCompletion" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "confirmedById" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseDocumentCompletion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseDocumentReminder" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "sentById" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dedupeKey" TEXT NOT NULL,
  CONSTRAINT "CaseDocumentReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseDocumentCompletion_caseId_key" ON "CaseDocumentCompletion"("caseId");
CREATE INDEX "CaseDocumentRequirement_caseId_active_status_idx" ON "CaseDocumentRequirement"("caseId", "active", "status");
CREATE INDEX "CaseDocumentReminder_caseId_sentAt_idx" ON "CaseDocumentReminder"("caseId", "sentAt");
CREATE UNIQUE INDEX "CaseDocumentReminder_dedupeKey_key" ON "CaseDocumentReminder"("dedupeKey");
CREATE INDEX "CaseDocument_requirementId_createdAt_idx" ON "CaseDocument"("requirementId", "createdAt");

ALTER TABLE "Case" ADD CONSTRAINT "Case_fileReadyById_fkey" FOREIGN KEY ("fileReadyById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseDocumentRequirement" ADD CONSTRAINT "CaseDocumentRequirement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseDocumentCompletion" ADD CONSTRAINT "CaseDocumentCompletion_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseDocumentCompletion" ADD CONSTRAINT "CaseDocumentCompletion_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseDocumentReminder" ADD CONSTRAINT "CaseDocumentReminder_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseDocumentReminder" ADD CONSTRAINT "CaseDocumentReminder_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseDocument" ADD CONSTRAINT "CaseDocument_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "CaseDocumentRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
