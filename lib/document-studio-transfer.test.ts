import assert from "node:assert/strict";
import test from "node:test";
import { hashTransferToken, transferIsActive } from "./document-studio-transfer";
test("transfer tokens are hashed and sessions reject expiry or revocation", () => { assert.notEqual(hashTransferToken("token"), "token"); assert.equal(transferIsActive({ expiresAt: new Date(Date.now() + 1), revokedAt: null, consumedAt: null }), true); assert.equal(transferIsActive({ expiresAt: new Date(0), revokedAt: null, consumedAt: null }), false); assert.equal(transferIsActive({ expiresAt: new Date(Date.now() + 1), revokedAt: new Date(), consumedAt: null }), false); });
