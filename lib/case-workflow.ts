import type { CaseStatus, MatterType } from "@prisma/client";

export const assessmentFeeCents = 10_000;
export const requestedDocumentsReceivedTitle = "Requested client documents received";

export const countries = ["Finland", "Sweden", "Germany", "United Kingdom", "Canada", "Australia"] as const;

export const matters: { value: MatterType; label: string }[] = [
  { value: "IMMIGRATION", label: "Immigration" },
  { value: "INTEGRATION", label: "Integration" },
  { value: "LICENSE_CONVERSION", label: "License Conversion" },
  { value: "LICENSE_UPGRADE_GUIDE", label: "License Upgrade Guide" },
  { value: "SOCIAL_BENEFIT_GUIDANCE", label: "Social Benefit Guidance" },
  { value: "OTHER", label: "Other" },
];

export const statusLabels: Record<CaseStatus, string> = {
  AWAITING_ASSESSMENT_REVIEW: "Awaiting professional review",
  ASSESSMENT_REQUEST_DECLINED: "Assessment request declined",
  AWAITING_ASSESSMENT_PAYMENT: "Awaiting assessment payment",
  ASSESSMENT_PAID: "Assessment queued",
  ASSESSMENT_IN_PROGRESS: "Assessment in progress",
  AWAITING_CLIENT_DECISION: "Awaiting your decision",
  AWAITING_DOCUMENTS_AND_PAYMENT: "Awaiting documents and payment",
  DOCUMENT_REVIEW: "Document review",
  MAIN_WORK_IN_PROGRESS: "Main work in progress",
  PREPARING_DOCUMENTS: "Preparing documents",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function manualStatusTransitions(status: CaseStatus, assessmentPaid: boolean): CaseStatus[] {
  if (status === "ASSESSMENT_PAID" && assessmentPaid) return ["ASSESSMENT_IN_PROGRESS"];
  return [];
}

export function assessmentRequestDecisionStatus(
  status: CaseStatus,
  decision: "APPROVE" | "DECLINE",
): CaseStatus | null {
  if (status !== "AWAITING_ASSESSMENT_REVIEW") return null;
  return decision === "APPROVE" ? "AWAITING_ASSESSMENT_PAYMENT" : "ASSESSMENT_REQUEST_DECLINED";
}

export function canPayAssessmentFee(status: CaseStatus) {
  return status === "AWAITING_ASSESSMENT_PAYMENT";
}

export function canManuallyTransitionCaseStatus(
  currentStatus: CaseStatus,
  nextStatus: CaseStatus,
  assessmentPaid: boolean,
) {
  return manualStatusTransitions(currentStatus, assessmentPaid).includes(nextStatus);
}

export function canConfirmRequestedDocuments(input: {
  title: string;
  clientDocumentCount: number;
  status: CaseStatus;
  clientDecision: "PROCEED" | "DO_NOT_PROCEED" | null;
}) {
  return input.title === requestedDocumentsReceivedTitle
    && input.clientDocumentCount > 0
    && input.status === "AWAITING_DOCUMENTS_AND_PAYMENT"
    && input.clientDecision === "PROCEED";
}

export function canRequestRemainingPayment(input: {
  assessmentPaid: boolean;
  status: CaseStatus;
  clientDecision: "PROCEED" | "DO_NOT_PROCEED" | null;
  requestedDocumentsConfirmed: boolean;
}) {
  return input.assessmentPaid
    && input.status === "AWAITING_DOCUMENTS_AND_PAYMENT"
    && input.clientDecision === "PROCEED"
    && input.requestedDocumentsConfirmed;
}

export function statusAfterPayment(stage: "ASSESSMENT" | "REMAINING_BALANCE"): CaseStatus {
  return stage === "ASSESSMENT" ? "ASSESSMENT_PAID" : "DOCUMENT_REVIEW";
}

export function completedChecklistTitleAfterPayment(stage: "ASSESSMENT" | "REMAINING_BALANCE") {
  return stage === "REMAINING_BALANCE" ? "Remaining balance paid" : null;
}

export function progressFromChecklist(items: { completedAt: Date | null }[]) {
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.completedAt).length / items.length) * 100);
}

export function nextAction(status: CaseStatus, role: "CLIENT" | "PROFESSIONAL" | "ADMIN") {
  if (role === "CLIENT") {
    if (status === "AWAITING_ASSESSMENT_REVIEW") return "Wait for the professional to review your assessment request";
    if (status === "ASSESSMENT_REQUEST_DECLINED") return "This assessment request was declined";
    if (status === "AWAITING_ASSESSMENT_PAYMENT") return "Pay the €100 assessment fee";
    if (status === "AWAITING_CLIENT_DECISION") return "Confirm whether you want to proceed";
    if (status === "AWAITING_DOCUMENTS_AND_PAYMENT") return "Upload requested documents and pay the balance";
    if (status === "COMPLETED") return "Review your released documents";
    return "Wait for the professional's next update";
  }
  if (status === "AWAITING_ASSESSMENT_REVIEW") return "Approve or decline the assessment request";
  if (status === "ASSESSMENT_REQUEST_DECLINED") return "No further assessment action is available";
  if (status === "ASSESSMENT_PAID") return "Start the assessment";
  if (status === "ASSESSMENT_IN_PROGRESS") return "Complete the assessment";
  if (status === "AWAITING_DOCUMENTS_AND_PAYMENT") return "Review incoming documents and payment";
  if (status === "DOCUMENT_REVIEW") return "Review the client documents";
  if (status === "MAIN_WORK_IN_PROGRESS") return "Update checklist and prepare documents";
  return "Update the case when work advances";
}

export function euros(value: number | string | { toString(): string }) {
  return new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR" }).format(Number(value));
}
