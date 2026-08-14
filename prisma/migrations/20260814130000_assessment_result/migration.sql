-- CreateEnum
CREATE TYPE "AssessmentOutcome" AS ENUM ('ELIGIBLE', 'POTENTIALLY_ELIGIBLE', 'MORE_INFORMATION_REQUIRED', 'NOT_RECOMMENDED');

-- CreateEnum
CREATE TYPE "ClientDecision" AS ENUM ('PROCEED', 'DO_NOT_PROCEED');

-- CreateTable
CREATE TABLE "CaseAssessment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "outcome" "AssessmentOutcome" NOT NULL,
    "assessmentText" TEXT NOT NULL,
    "recommendedRoute" TEXT NOT NULL,
    "issuesRisks" TEXT NOT NULL,
    "nextSteps" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "clientDecision" "ClientDecision",
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseAssessment_caseId_key" ON "CaseAssessment"("caseId");

-- AddForeignKey
ALTER TABLE "CaseAssessment" ADD CONSTRAINT "CaseAssessment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
