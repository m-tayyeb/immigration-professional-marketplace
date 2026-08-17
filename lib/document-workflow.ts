export type RequirementState = "REQUESTED" | "RECEIVED" | "ACCEPTED" | "REPLACEMENT_REQUIRED";

export function canConfirmDocumentCollection(requirements: readonly { active: boolean; status: RequirementState }[]) {
  const active = requirements.filter((item) => item.active);
  return active.length > 0 && active.every((item) => item.status === "ACCEPTED");
}

export function statusAfterRequirementUpload(current: RequirementState): RequirementState {
  return current === "ACCEPTED" ? "ACCEPTED" : "RECEIVED";
}

export function outstandingDocuments(requirements: readonly { active: boolean; status: RequirementState }[]) {
  return requirements.some((item) => item.active && item.status !== "ACCEPTED");
}

export function reminderAllowed(lastSentAt: Date | null, now: Date, cooldownMinutes = 5) {
  return !lastSentAt || now.getTime() - lastSentAt.getTime() >= cooldownMinutes * 60_000;
}

export function remainingAmountFromDecision(decision: {
  decision: "PROCEED" | "DO_NOT_PROCEED";
  financialObligationConfirmed: boolean;
  remainingAmountAcknowledged: number | null;
}) {
  const amount = decision.remainingAmountAcknowledged;
  return decision.decision === "PROCEED" && decision.financialObligationConfirmed && amount !== null && Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function canMarkFileReady(remainingPaymentPaid: boolean, alreadyReady: boolean) {
  return remainingPaymentPaid && !alreadyReady;
}

export function canStartFinalReviewAppointment(remainingPaymentPaid: boolean, fileReady: boolean) {
  return remainingPaymentPaid && fileReady;
}

export function uploadActorForRole(role: "CLIENT" | "PROFESSIONAL" | "ADMIN") {
  return role === "CLIENT" ? "CLIENT" as const : "PROFESSIONAL" as const;
}

export function canManageCaseDocuments(user: { id: string; role: "CLIENT" | "PROFESSIONAL" | "ADMIN" }, assignedProfessionalUserId: string) {
  return user.role === "ADMIN" || (user.role === "PROFESSIONAL" && user.id === assignedProfessionalUserId);
}
