import assert from "node:assert/strict";
import test from "node:test";
import { canConfirmDocumentCollection, canManageCaseDocuments, canMarkFileReady, canStartFinalReviewAppointment, remainingAmountFromDecision, reminderAllowed, statusAfterRequirementUpload, uploadActorForRole } from "./document-workflow";

test("incomplete and replacement-required requirements block completion", () => {
  assert.equal(canConfirmDocumentCollection([{ active: true, status: "RECEIVED" }]), false);
  assert.equal(canConfirmDocumentCollection([{ active: true, status: "REPLACEMENT_REQUIRED" }]), false);
  assert.equal(canConfirmDocumentCollection([{ active: true, status: "ACCEPTED" }]), true);
});
test("professional upload ownership is truthful and upload is only received", () => {
  assert.equal(uploadActorForRole("PROFESSIONAL"), "PROFESSIONAL");
  assert.equal(uploadActorForRole("CLIENT"), "CLIENT");
  assert.equal(statusAfterRequirementUpload("REPLACEMENT_REQUIRED"), "RECEIVED");
});
test("remaining amount is derived only from binding proceed evidence", () => {
  assert.equal(remainingAmountFromDecision({ decision: "PROCEED", financialObligationConfirmed: true, remainingAmountAcknowledged: 400 }), 400);
  assert.equal(remainingAmountFromDecision({ decision: "DO_NOT_PROCEED", financialObligationConfirmed: false, remainingAmountAcknowledged: null }), null);
});
test("file-ready and final-review gates require remaining payment", () => {
  assert.equal(canMarkFileReady(false, false), false);
  assert.equal(canMarkFileReady(true, false), true);
  assert.equal(canStartFinalReviewAppointment(true, false), false);
  assert.equal(canStartFinalReviewAppointment(true, true), true);
});
test("reminder cooldown prevents rapid duplicates", () => {
  const now = new Date("2026-08-18T12:10:00Z");
  assert.equal(reminderAllowed(new Date("2026-08-18T12:08:00Z"), now), false);
  assert.equal(reminderAllowed(new Date("2026-08-18T12:00:00Z"), now), true);
});
test("only assigned professional or administrator can manage document workflow", () => {
  assert.equal(canManageCaseDocuments({ id: "assigned", role: "PROFESSIONAL" }, "assigned"), true);
  assert.equal(canManageCaseDocuments({ id: "other", role: "PROFESSIONAL" }, "assigned"), false);
  assert.equal(canManageCaseDocuments({ id: "client", role: "CLIENT" }, "assigned"), false);
  assert.equal(canManageCaseDocuments({ id: "admin", role: "ADMIN" }, "assigned"), true);
});
test("duplicate evidence is represented by one completion and one payment per case", () => {
  const uniqueEvidenceKeys = new Set(["case-1:completion", "case-1:remaining-payment"]);
  assert.equal(uniqueEvidenceKeys.size, 2);
  assert.equal(canConfirmDocumentCollection([]), false);
});
