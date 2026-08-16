import assert from "node:assert/strict";
import test from "node:test";
import { canManuallyTransitionCaseStatus, manualStatusTransitions } from "./case-workflow";

test("allows a paid assessment to move from queued to in progress", () => {
  assert.equal(canManuallyTransitionCaseStatus("ASSESSMENT_PAID", "ASSESSMENT_IN_PROGRESS", true), true);
  assert.deepEqual(manualStatusTransitions("ASSESSMENT_PAID", true), ["ASSESSMENT_IN_PROGRESS"]);
});

test("rejects an invalid manual transition", () => {
  assert.equal(canManuallyTransitionCaseStatus("ASSESSMENT_IN_PROGRESS", "ASSESSMENT_PAID", true), false);
});

test("does not allow an unpaid case to start assessment", () => {
  assert.equal(canManuallyTransitionCaseStatus("ASSESSMENT_PAID", "ASSESSMENT_IN_PROGRESS", false), false);
  assert.deepEqual(manualStatusTransitions("ASSESSMENT_PAID", false), []);
});

test("does not allow a professional to jump ahead to action-controlled statuses", () => {
  const protectedStatuses = [
    "AWAITING_CLIENT_DECISION",
    "AWAITING_DOCUMENTS_AND_PAYMENT",
    "DOCUMENT_REVIEW",
    "MAIN_WORK_IN_PROGRESS",
    "PREPARING_DOCUMENTS",
    "COMPLETED",
    "CANCELLED",
  ] as const;

  for (const status of protectedStatuses) {
    assert.equal(canManuallyTransitionCaseStatus("ASSESSMENT_PAID", status, true), false, status);
  }
});
