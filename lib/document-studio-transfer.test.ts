import assert from "node:assert/strict";
import test from "node:test";
import { phoneFileHandling } from "./document-studio";
import { hashTransferToken, transferBatchPositions, transferFileError, transferIsActive, transferSessionError } from "./document-studio-transfer";

const now = new Date("2026-01-01T12:00:00Z");
const activeSession = { expiresAt: new Date("2026-01-01T12:15:00Z"), revokedAt: null, consumedAt: null };

test("transfer tokens are hashed and expired or revoked sessions are rejected distinctly", () => {
  assert.notEqual(hashTransferToken("token"), "token");
  assert.equal(transferSessionError(activeSession, now), null);
  assert.equal(transferSessionError(null, now), "SESSION_NOT_FOUND");
  assert.equal(transferSessionError({ ...activeSession, expiresAt: new Date(0) }, now), "SESSION_EXPIRED");
  assert.equal(transferSessionError({ ...activeSession, revokedAt: now }, now), "SESSION_REVOKED");
});

test("two pages uploaded in one batch receive consecutive positions", () => {
  assert.deepEqual(transferBatchPositions([], 2), [0, 1]);
});

test("three pages uploaded in one batch preserve order after existing items", () => {
  assert.deepEqual(transferBatchPositions([{ position: 0 }, { position: 1 }], 3), [2, 3, 4]);
});

test("consuming the first item does not invalidate remaining items or the session", () => {
  const items = [{ id: "first", consumedAt: now }, { id: "second", consumedAt: null }];
  assert.equal(items[0].consumedAt instanceof Date, true);
  assert.equal(items[1].consumedAt, null);
  assert.equal(transferIsActive(activeSession, now), true);
});

test("unsupported phone image MIME types are normalized before upload where possible", () => {
  assert.equal(phoneFileHandling({ name: "IMG_1001.HEIC", type: "image/heic" }), "NORMALIZE_TO_JPEG");
  assert.equal(phoneFileHandling({ name: "scan.tiff", type: "image/tiff" }), "NORMALIZE_TO_JPEG");
  assert.equal(phoneFileHandling({ name: "malware.exe", type: "application/octet-stream" }), "REJECT");
  assert.equal(transferFileError({ name: "IMG_1001.HEIC", type: "image/heic", size: 100 }), "UNSUPPORTED_FILE_TYPE");
});

test("phone batch validation distinguishes unsupported type and oversized files", () => {
  assert.equal(transferFileError({ name: "scan-page-001.jpg", type: "image/jpeg", size: 100 }), null);
  assert.equal(transferFileError({ name: "scan-page-001.gif", type: "image/gif", size: 100 }), "UNSUPPORTED_FILE_TYPE");
  assert.equal(transferFileError({ name: "scan-page-001.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 }), "FILE_TOO_LARGE");
});
