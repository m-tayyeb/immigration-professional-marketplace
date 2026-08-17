import type { CaseStatus, ClientDecision } from "@prisma/client";

export const serviceAgreementVersion = "casewiser-service-continuation-v1";

export function deriveServiceAgreementAmounts(totalServiceAmount: number | null, assessmentPaidAmount: number) {
  if (totalServiceAmount === null || !Number.isFinite(totalServiceAmount) || totalServiceAmount < 0) return null;
  if (!Number.isFinite(assessmentPaidAmount) || assessmentPaidAmount < 0) return null;
  const totalCents = Math.round(totalServiceAmount * 100);
  const paidCents = Math.round(assessmentPaidAmount * 100);
  if (paidCents > totalCents) return null;
  return {
    assessmentPaidAmount: paidCents / 100,
    totalServiceAmount: totalCents / 100,
    remainingAmountAcknowledged: (totalCents - paidCents) / 100,
  };
}

export function serviceAgreementText(amounts: { assessmentPaidAmount: number; totalServiceAmount: number; remainingAmountAcknowledged: number }) {
  return `I confirm that I want to proceed with this service and understand that €${amounts.remainingAmountAcknowledged.toFixed(2)} remains payable as part of the agreed €${amounts.totalServiceAmount.toFixed(2)} service fee. The €${amounts.assessmentPaidAmount.toFixed(2)} assessment payment is included in that total.`;
}

export function hasFinancialAcknowledgement(value: FormDataEntryValue | null) {
  return value === "on";
}

export function buildProceedDecisionEvidence(amounts: { assessmentPaidAmount: number; totalServiceAmount: number; remainingAmountAcknowledged: number }, decidedAt: Date) {
  return {
    decision: "PROCEED" as const,
    decidedAt,
    ...amounts,
    financialObligationConfirmed: true,
    agreementVersion: serviceAgreementVersion,
    agreementText: serviceAgreementText(amounts),
  };
}

export function buildDoNotProceedDecisionEvidence(decidedAt: Date) {
  return { decision: "DO_NOT_PROCEED" as const, decidedAt, financialObligationConfirmed: false };
}

export function historicalDecisionIsReadable(decision: ClientDecision | null, agreementExists: boolean) {
  return decision !== null && !agreementExists;
}

export function canRecordClientDecision(input: {
  userId: string;
  userRole: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  caseClientId: string;
  status: CaseStatus;
  assessmentReleased: boolean;
  existingDecision: ClientDecision | null;
  agreementExists: boolean;
}) {
  return input.userRole === "CLIENT"
    && input.userId === input.caseClientId
    && input.status === "AWAITING_CLIENT_DECISION"
    && input.assessmentReleased
    && input.existingDecision === null
    && !input.agreementExists;
}

export function decisionCreatesFinancialObligation(decision: ClientDecision) {
  return decision === "PROCEED";
}
