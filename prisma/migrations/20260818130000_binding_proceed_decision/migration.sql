-- Add immutable service-decision evidence without rewriting historical case decisions.
CREATE TABLE "CaseServiceDecision" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "decision" "ClientDecision" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessmentPaidAmount" DECIMAL(10,2),
    "totalServiceAmount" DECIMAL(10,2),
    "remainingAmountAcknowledged" DECIMAL(10,2),
    "financialObligationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "agreementVersion" TEXT,
    "agreementText" TEXT,
    CONSTRAINT "CaseServiceDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseServiceDecision_caseId_key" ON "CaseServiceDecision"("caseId");
CREATE INDEX "CaseServiceDecision_clientId_decidedAt_idx" ON "CaseServiceDecision"("clientId", "decidedAt");

ALTER TABLE "CaseServiceDecision" ADD CONSTRAINT "CaseServiceDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseServiceDecision" ADD CONSTRAINT "CaseServiceDecision_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
