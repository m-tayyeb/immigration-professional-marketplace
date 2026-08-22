export const studioAllowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
export const studioAllowedExtensions = new Set(["pdf", "jpg", "jpeg", "png"]);
export const studioMaxFileSize = 10 * 1024 * 1024;
export const studioDocumentTypes = [
  "Passport", "Residence permit", "Identity document", "Bank statement",
  "Employment contract", "Payslip", "Tax document", "Insurance document",
  "Accommodation document", "Family document", "Migri request", "Migri decision",
  "Application document", "Other",
] as const;

export function hasDocumentStudioEntitlement(payments: readonly { stage: string; status: string }[]) {
  return payments.some((payment) => payment.stage === "ASSESSMENT" && payment.status === "PAID");
}

export function validateStudioFile(file: { name: string; type: string; size: number }) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return Boolean(file.name && file.size > 0 && file.size <= studioMaxFileSize && studioAllowedExtensions.has(extension) && studioAllowedMimeTypes.has(file.type));
}

export function isStudioDocumentType(value: string): value is (typeof studioDocumentTypes)[number] {
  return studioDocumentTypes.includes(value as (typeof studioDocumentTypes)[number]);
}

export function shortCaseReference(id: string) {
  return `CW-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;
}

export function studioCaseLabel(input: { id: string; service: string; clientName?: string | null }, role: "CLIENT" | "PROFESSIONAL" | "ADMIN") {
  const details = `${input.service} — ${shortCaseReference(input.id)}`;
  return role === "CLIENT" ? details : `${input.clientName || "Client"} — ${details}`;
}

export function mergeReceivedItemIds(current: readonly string[], incoming: readonly string[]) {
  const seen = new Set(current);
  return [...current, ...incoming.filter((id) => !seen.has(id) && Boolean(seen.add(id)))];
}

export function invalidateGeneratedPdf<T>() {
  return null as T | null;
}

export type StudioPdfVersion = "original" | "optimized";

export function evaluatePdfOptimization(originalSize: number, candidateSize: number) {
  const accepted = originalSize > 0 && candidateSize > 0 && candidateSize < originalSize;
  return { accepted, savedPercent: accepted ? Math.round((1 - candidateSize / originalSize) * 100) : 0 };
}

export function selectedStudioPdf<T>(original: T, optimized: T | null, version: StudioPdfVersion) {
  return version === "optimized" && optimized !== null ? optimized : original;
}
