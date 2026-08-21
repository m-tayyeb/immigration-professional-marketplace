export const studioAllowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
export const studioAllowedExtensions = new Set(["pdf", "jpg", "jpeg", "png"]);
export const studioMaxFileSize = 10 * 1024 * 1024;

export function hasDocumentStudioEntitlement(payments: readonly { stage: string; status: string }[]) {
  return payments.some((payment) => payment.stage === "ASSESSMENT" && payment.status === "PAID");
}

export function validateStudioFile(file: { name: string; type: string; size: number }) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return Boolean(file.name && file.size > 0 && file.size <= studioMaxFileSize && studioAllowedExtensions.has(extension) && studioAllowedMimeTypes.has(file.type));
}
