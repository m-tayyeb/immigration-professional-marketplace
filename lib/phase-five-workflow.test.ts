import assert from "node:assert/strict";
import test from "node:test";
import { canAddSupplement, canCompleteCase, canRecordMainSubmission, canRecordMigriDecision, canSubmitSupplementaryResponse } from "./phase-five-workflow";

test("submission is gated, authorized, and unique", () => {
  assert.equal(canRecordMainSubmission({ remainingPaid: true, fileReady: true, finalReviewExists: true, alreadySubmitted: false, professional: true }), true);
  assert.equal(canRecordMainSubmission({ remainingPaid: true, fileReady: true, finalReviewExists: true, alreadySubmitted: true, professional: true }), false);
  assert.equal(canRecordMainSubmission({ remainingPaid: true, fileReady: true, finalReviewExists: true, alreadySubmitted: false, professional: false }), false);
});
test("supplement cycles are independent and blocked after decision", () => {
  assert.equal(canAddSupplement({ mainSubmitted: true, decisionExists: false }), true);
  assert.equal(canAddSupplement({ mainSubmitted: true, decisionExists: true }), false);
  assert.equal(canSubmitSupplementaryResponse({ professional: true, decisionExists: false, alreadySubmitted: false, requirements: [{ active: true, status: "ACCEPTED" }] }), true);
  assert.equal(canSubmitSupplementaryResponse({ professional: true, decisionExists: false, alreadySubmitted: false, requirements: [{ active: true, status: "RECEIVED" }] }), false);
});
test("decision and completion require authorized, unique predecessor evidence", () => {
  assert.equal(canRecordMigriDecision({ professional: true, mainSubmitted: true, decisionExists: false }), true);
  assert.equal(canRecordMigriDecision({ professional: false, mainSubmitted: true, decisionExists: false }), false);
  assert.equal(canCompleteCase({ professional: true, decisionExists: true, completed: false }), true);
  assert.equal(canCompleteCase({ professional: true, decisionExists: false, completed: false }), false);
  assert.equal(canCompleteCase({ professional: true, decisionExists: true, completed: true }), false);
});
