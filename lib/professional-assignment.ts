export const annaLaineSeedEmail = "anna.laine@example.test";
export const finlandMvpAssignableServiceCodes = ["FIRST_RESIDENCE_PERMIT", "RESIDENCE_PERMIT_RENEWAL"] as const;

export function acceptsNewFinlandMvpCases(email: string) {
  return email.trim().toLowerCase() === annaLaineSeedEmail;
}

export function isFinlandMvpAssignableServiceCode(code: string | null | undefined) {
  return typeof code === "string" && (finlandMvpAssignableServiceCodes as readonly string[]).includes(code);
}

type AssignmentCandidate = {
  id: string;
  createdAt: Date;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  acceptingNewCases: boolean;
  countries: { countryId: string }[];
  services: { serviceId: string }[];
};

export function professionalEligibilityWhere(countryId: string, serviceId: string) {
  return {
    verificationStatus: "VERIFIED" as const,
    acceptingNewCases: true,
    countries: { some: { countryId } },
    services: { some: { serviceId } },
  };
}

export function isProfessionalEligibleForAssignment(candidate: AssignmentCandidate, countryId: string, serviceId: string) {
  return candidate.verificationStatus === "VERIFIED"
    && candidate.acceptingNewCases
    && candidate.countries.some((country) => country.countryId === countryId)
    && candidate.services.some((service) => service.serviceId === serviceId);
}

export function selectProfessionalForAssignment(
  candidates: AssignmentCandidate[],
  countryId: string,
  serviceId: string,
) {
  return candidates
    .filter((candidate) => isProfessionalEligibleForAssignment(candidate, countryId, serviceId))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0] ?? null;
}

export function caseAccessWhere(caseId: string, user: { id: string; role: "CLIENT" | "PROFESSIONAL" | "ADMIN" }) {
  if (user.role === "CLIENT") return { id: caseId, clientId: user.id };
  if (user.role === "PROFESSIONAL") return { id: caseId, professional: { userId: user.id } };
  return { id: caseId };
}
