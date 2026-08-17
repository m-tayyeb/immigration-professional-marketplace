-- Phase 1 and 2 are additive so existing users and cases remain valid.
CREATE TYPE "ConsultationMethod" AS ENUM ('ONLINE', 'TELEPHONE', 'FACE_TO_FACE');

CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientProfile_userId_key" ON "ClientProfile"("userId");

ALTER TABLE "ClientProfile"
ADD CONSTRAINT "ClientProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CaseContactSnapshot" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseContactSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseContactSnapshot_caseId_key" ON "CaseContactSnapshot"("caseId");

ALTER TABLE "CaseContactSnapshot"
ADD CONSTRAINT "CaseContactSnapshot_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Case"
ADD COLUMN "situationDescription" TEXT,
ADD COLUMN "preferredConsultationMethod" "ConsultationMethod",
ADD COLUMN "preferredAvailability" TEXT,
ADD COLUMN "relevantDeadline" TIMESTAMP(3),
ADD COLUMN "additionalMessage" TEXT,
ADD COLUMN "confirmedConsultationMethod" "ConsultationMethod",
ADD COLUMN "appointmentAtUtc" TIMESTAMPTZ(3),
ADD COLUMN "appointmentTimeZone" TEXT,
ADD COLUMN "professionalMessage" TEXT,
ADD COLUMN "appointmentInstructions" TEXT,
ADD COLUMN "declineReason" TEXT;
