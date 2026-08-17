export function documentAccessWhere(documentId: string, user: { id: string; role: "CLIENT" | "PROFESSIONAL" | "ADMIN" }) {
  if (user.role === "CLIENT") return { id: documentId, case: { clientId: user.id }, OR: [{ folder: "CLIENT" as const }, { folder: "PROFESSIONAL" as const, releasedToClientAt: { not: null } }] };
  if (user.role === "PROFESSIONAL") return { id: documentId, case: { professional: { userId: user.id } } };
  return { id: documentId };
}

export function canUploadToCase(user: { id: string; role: "CLIENT" | "PROFESSIONAL" | "ADMIN" }, caseClientId: string, assignedProfessionalUserId: string) {
  return user.role === "ADMIN" || (user.role === "CLIENT" && user.id === caseClientId) || (user.role === "PROFESSIONAL" && user.id === assignedProfessionalUserId);
}
