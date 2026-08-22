import assert from "node:assert/strict";
import test from "node:test";
import { hashTransferToken, transferIsActive } from "./document-studio-transfer";
test("transfer tokens are hashed and sessions reject expiry or revocation", () => { const now = new Date("2026-01-01T12:00:00Z"); assert.notEqual(hashTransferToken("token"), "token"); assert.equal(transferIsActive({ expiresAt: new Date("2026-01-01T12:15:00Z"), revokedAt: null, consumedAt: null }, now), true); assert.equal(transferIsActive({ expiresAt: new Date(0), revokedAt: null, consumedAt: null }, now), false); assert.equal(transferIsActive({ expiresAt: new Date("2026-01-01T12:15:00Z"), revokedAt: now, consumedAt: null }, now), false); });
