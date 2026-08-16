import assert from "node:assert/strict";
import test from "node:test";
import { assessmentRequestDecisionStatus, canPayAssessmentFee, manualStatusTransitions, statusAfterPayment } from "./case-workflow";

test("professional approval makes the assessment payment due", () => {
  const status = assessmentRequestDecisionStatus("AWAITING_ASSESSMENT_REVIEW", "APPROVE");
  assert.equal(status, "AWAITING_ASSESSMENT_PAYMENT");
  assert.equal(canPayAssessmentFee(status!), true);
});

test("professional decline prevents payment and assessment work", () => {
  const status = assessmentRequestDecisionStatus("AWAITING_ASSESSMENT_REVIEW", "DECLINE");
  assert.equal(status, "ASSESSMENT_REQUEST_DECLINED");
  assert.equal(canPayAssessmentFee(status!), false);
  assert.deepEqual(manualStatusTransitions(status!, false), []);
});

test("assessment payment is rejected before professional approval", () => {
  assert.equal(canPayAssessmentFee("AWAITING_ASSESSMENT_REVIEW"), false);
});

test("approved assessment payment enters the existing queued workflow", () => {
  assert.equal(canPayAssessmentFee("AWAITING_ASSESSMENT_PAYMENT"), true);
  const paidStatus = statusAfterPayment("ASSESSMENT");
  assert.equal(paidStatus, "ASSESSMENT_PAID");
  assert.deepEqual(manualStatusTransitions(paidStatus, true), ["ASSESSMENT_IN_PROGRESS"]);
});
