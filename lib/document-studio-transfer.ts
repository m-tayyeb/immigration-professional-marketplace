import { createHash, randomBytes } from "node:crypto";
import { studioMaxFileSize, validateStudioFile } from "./document-studio";

export const transferLifetimeMs = 15 * 60_000;
export const hashTransferToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newTransferToken = () => randomBytes(32).toString("base64url");

type TransferSession = { expiresAt: Date; revokedAt: Date | null; consumedAt?: Date | null };
export type TransferSessionError = "SESSION_NOT_FOUND" | "SESSION_EXPIRED" | "SESSION_REVOKED";

export function transferSessionError(session: TransferSession | null, now = new Date()): TransferSessionError | null {
  if (!session) return "SESSION_NOT_FOUND";
  if (session.revokedAt) return "SESSION_REVOKED";
  if (session.expiresAt <= now) return "SESSION_EXPIRED";
  return null;
}

// Consuming an item never ends its parent session. Only revocation or expiry does.
export const transferIsActive = (session: TransferSession, now = new Date()) => transferSessionError(session, now) === null;

export type TransferFileError = "UNSUPPORTED_FILE_TYPE" | "FILE_TOO_LARGE";
export function transferFileError(file: { name: string; type: string; size: number }): TransferFileError | null {
  if (file.size > studioMaxFileSize) return "FILE_TOO_LARGE";
  return validateStudioFile(file) ? null : "UNSUPPORTED_FILE_TYPE";
}

export function transferBatchPositions(existing: readonly { position: number }[], count: number) {
  const start = existing.reduce((maximum, item) => Math.max(maximum, item.position), -1) + 1;
  return Array.from({ length: count }, (_, index) => start + index);
}

export function existingTransferPage<T extends { position: number; fileName: string }>(items: readonly T[], position: number, fileName: string) {
  return items.find((item) => item.position === position && item.fileName === fileName) ?? null;
}
