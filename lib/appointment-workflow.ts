import type { CaseAppointmentPurpose, CaseAppointmentStatus, CaseStatus } from "@prisma/client";

export const appointmentPurposes = ["ASSESSMENT_CONSULTATION", "FINAL_FILE_REVIEW", "SUPPLEMENTARY_REQUEST"] as const;
export const confirmationSources = ["TELEPHONE", "EXTERNAL_MESSAGE", "FACE_TO_FACE", "OTHER"] as const;
export const activeAppointmentStatuses = ["PROPOSED", "CHANGE_REQUESTED", "CONFIRMED"] as const;

export function parseAppointmentPurpose(value: FormDataEntryValue | null): CaseAppointmentPurpose | null {
  const purpose = String(value ?? "");
  return appointmentPurposes.includes(purpose as CaseAppointmentPurpose) ? purpose as CaseAppointmentPurpose : null;
}

export function parseConfirmationSource(value: FormDataEntryValue | null) {
  const source = String(value ?? "");
  return confirmationSources.includes(source as (typeof confirmationSources)[number]) ? source as (typeof confirmationSources)[number] : null;
}

export function appointmentRequiresPayment(purpose: CaseAppointmentPurpose) {
  return purpose === "ASSESSMENT_CONSULTATION";
}

export function appointmentConfirmationEffect(purpose: CaseAppointmentPurpose, assessmentPaymentExists: boolean) {
  return {
    createAssessmentPayment: appointmentRequiresPayment(purpose) && !assessmentPaymentExists,
    caseStatus: appointmentRequiresPayment(purpose) ? "AWAITING_ASSESSMENT_PAYMENT" as const : null,
  };
}

export function appointmentProposalEffect() {
  return { status: "PROPOSED" as const, createAssessmentPayment: false };
}

export function appendAppointmentRevision<T>(history: readonly T[], revision: T) {
  return [...history, revision];
}

export function canViewNotification(recipientId: string, viewerId: string) {
  return recipientId === viewerId;
}

export function isActiveAppointmentStatus(status: CaseAppointmentStatus) {
  return (activeAppointmentStatuses as readonly CaseAppointmentStatus[]).includes(status);
}

export function activeAppointmentForPurpose<T extends { purpose: CaseAppointmentPurpose; status: CaseAppointmentStatus }>(
  appointments: readonly T[],
  purpose: CaseAppointmentPurpose,
) {
  return appointments.find((appointment) => appointment.purpose === purpose && isActiveAppointmentStatus(appointment.status)) ?? null;
}

export function canCreateAppointmentForPurpose(
  appointments: readonly { purpose: CaseAppointmentPurpose; status: CaseAppointmentStatus }[],
  purpose: CaseAppointmentPurpose,
) {
  return activeAppointmentForPurpose(appointments, purpose) === null;
}

export function canOfficiallyManageAppointment(
  user: { id: string; role: "CLIENT" | "PROFESSIONAL" | "ADMIN" },
  assignedProfessionalUserId: string,
) {
  return user.role === "ADMIN" || (user.role === "PROFESSIONAL" && user.id === assignedProfessionalUserId);
}

export function canClientManageAppointment(user: { id: string; role: string }, clientId: string) {
  return user.role === "CLIENT" && user.id === clientId;
}

export function canPartyAccessAppointment(
  user: { id: string; role: "CLIENT" | "PROFESSIONAL" | "ADMIN" },
  clientId: string,
  assignedProfessionalUserId: string,
) {
  return user.role === "ADMIN" || (user.role === "CLIENT" && user.id === clientId) || (user.role === "PROFESSIONAL" && user.id === assignedProfessionalUserId);
}

export function assessmentPaymentAllowed(caseStatus: CaseStatus, appointmentStatus: CaseAppointmentStatus | null) {
  if (caseStatus !== "AWAITING_ASSESSMENT_PAYMENT") return false;
  // No reusable appointment means this is a compatible historical case.
  return appointmentStatus === null || appointmentStatus === "CONFIRMED";
}

export function canWithdrawAssessment(caseStatus: CaseStatus, assessmentPaid: boolean) {
  return !assessmentPaid && (caseStatus === "AWAITING_ASSESSMENT_REVIEW" || caseStatus === "AWAITING_ASSESSMENT_PAYMENT");
}

export function nextAppointmentStatusAfterProposal(): CaseAppointmentStatus {
  return "PROPOSED";
}

export function nextAppointmentStatusAfterChangeRequest(): CaseAppointmentStatus {
  return "CHANGE_REQUESTED";
}

export function nextAppointmentStatusAfterConfirmation(): CaseAppointmentStatus {
  return "CONFIRMED";
}
