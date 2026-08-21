import { createHash, randomBytes } from "node:crypto";
export const transferLifetimeMs = 15 * 60_000;
export const hashTransferToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newTransferToken = () => randomBytes(32).toString("base64url");
export const transferIsActive = (session: { expiresAt: Date; revokedAt: Date | null; consumedAt: Date | null }, now = new Date()) => !session.revokedAt && !session.consumedAt && session.expiresAt > now;
