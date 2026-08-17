-- Add a reusable case appointment agreement system without rewriting legacy appointment data.
ALTER TYPE "CaseStatus" ADD VALUE IF NOT EXISTS 'ASSESSMENT_REQUEST_WITHDRAWN';

CREATE TYPE "CaseAppointmentPurpose" AS ENUM ('ASSESSMENT_CONSULTATION', 'FINAL_FILE_REVIEW', 'SUPPLEMENTARY_REQUEST');
CREATE TYPE "CaseAppointmentStatus" AS ENUM ('PROPOSED', 'CHANGE_REQUESTED', 'CONFIRMED', 'WITHDRAWN', 'CANCELLED', 'COMPLETED');
CREATE TYPE "AppointmentConfirmationSource" AS ENUM ('TELEPHONE', 'EXTERNAL_MESSAGE', 'FACE_TO_FACE', 'OTHER');
CREATE TYPE "AppointmentMessageKind" AS ENUM ('MESSAGE', 'CHANGE_REQUEST', 'WITHDRAWAL');

CREATE TABLE "CaseAppointment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "purpose" "CaseAppointmentPurpose" NOT NULL,
    "status" "CaseAppointmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "method" "ConsultationMethod",
    "appointmentAtUtc" TIMESTAMPTZ(3),
    "timeZone" TEXT,
    "instructions" TEXT,
    "professionalMessage" TEXT,
    "bookedById" TEXT,
    "confirmationSource" "AppointmentConfirmationSource",
    "confirmationNote" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "changeRequestedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CaseAppointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseAppointmentRevision" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "method" "ConsultationMethod" NOT NULL,
    "appointmentAtUtc" TIMESTAMPTZ(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    CONSTRAINT "CaseAppointmentRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseAppointmentMessage" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "AppointmentMessageKind" NOT NULL DEFAULT 'MESSAGE',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseAppointmentMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification" ADD COLUMN "caseId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "appointmentId" TEXT;

CREATE INDEX "CaseAppointment_caseId_purpose_idx" ON "CaseAppointment"("caseId", "purpose");
CREATE UNIQUE INDEX "CaseAppointment_one_active_per_case_purpose_key"
ON "CaseAppointment"("caseId", "purpose")
WHERE "status" IN ('PROPOSED', 'CHANGE_REQUESTED', 'CONFIRMED');
CREATE INDEX "CaseAppointment_caseId_status_idx" ON "CaseAppointment"("caseId", "status");
CREATE INDEX "CaseAppointmentRevision_appointmentId_createdAt_idx" ON "CaseAppointmentRevision"("appointmentId", "createdAt");
CREATE INDEX "CaseAppointmentMessage_appointmentId_createdAt_idx" ON "CaseAppointmentMessage"("appointmentId", "createdAt");
CREATE INDEX "Notification_caseId_idx" ON "Notification"("caseId");
CREATE INDEX "Notification_appointmentId_idx" ON "Notification"("appointmentId");

ALTER TABLE "CaseAppointment" ADD CONSTRAINT "CaseAppointment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseAppointment" ADD CONSTRAINT "CaseAppointment_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseAppointmentRevision" ADD CONSTRAINT "CaseAppointmentRevision_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "CaseAppointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseAppointmentRevision" ADD CONSTRAINT "CaseAppointmentRevision_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseAppointmentRevision" ADD CONSTRAINT "CaseAppointmentRevision_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseAppointmentMessage" ADD CONSTRAINT "CaseAppointmentMessage_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "CaseAppointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseAppointmentMessage" ADD CONSTRAINT "CaseAppointmentMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "CaseAppointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
