import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDoNotProceedDecisionEvidence,
  buildProceedDecisionEvidence,
  canRecordClientDecision,
  decisionCreatesFinancialObligation,
  deriveServiceAgreementAmounts,
  hasFinancialAcknowledgement,
  historicalDecisionIsReadable,
  serviceAgreementVersion,
} from "./service-agreement";

const validDecision = {
  userId: "client-1",
  userRole: "CLIENT" as const,
  caseClientId: "client-1",
  status: "AWAITING_CLIENT_DECISION" as const,
  assessmentReleased: true,
  existingDecision: null,
  agreementExists: false,
};

test("Proceed is rejected before assessment release", () => {
  assert.equal(canRecordClientDecision({ ...validDecision, assessmentReleased: false }), false);
});

test("Proceed is rejected without mandatory financial confirmation", () => {
  assert.equal(hasFinancialAcknowledgement(null), false);
  assert.equal(hasFinancialAcknowledgement("off"), false);
  assert.equal(hasFinancialAcknowledgement("on"), true);
});

test("Proceed succeeds with a valid acknowledgement and permitted workflow state", () => {
  assert.equal(canRecordClientDecision(validDecision), true);
  assert.equal(hasFinancialAcknowledgement("on"), true);
});

test("agreement timestamp and financial amounts are persisted in immutable evidence", () => {
  const decidedAt = new Date("2030-01-02T10:00:00.000Z");
  const amounts = deriveServiceAgreementAmounts(500, 100)!;
  const evidence = buildProceedDecisionEvidence(amounts, decidedAt);
  assert.equal(evidence.decidedAt, decidedAt);
  assert.equal(evidence.totalServiceAmount, 500);
  assert.equal(evidence.assessmentPaidAmount, 100);
  assert.equal(evidence.remainingAmountAcknowledged, 400);
  assert.equal(evidence.financialObligationConfirmed, true);
  assert.equal(evidence.agreementVersion, serviceAgreementVersion);
  assert.match(evidence.agreementText, /€400\.00 remains payable/);
});

test("paid assessment is deducted from configured service total", () => {
  assert.deepEqual(deriveServiceAgreementAmounts(500, 100), { assessmentPaidAmount: 100, totalServiceAmount: 500, remainingAmountAcknowledged: 400 });
  assert.deepEqual(deriveServiceAgreementAmounts(750, 125), { assessmentPaidAmount: 125, totalServiceAmount: 750, remainingAmountAcknowledged: 625 });
});

test("duplicate Proceed cannot create a second agreement", () => {
  assert.equal(canRecordClientDecision({ ...validDecision, agreementExists: true }), false);
  assert.equal(canRecordClientDecision({ ...validDecision, existingDecision: "PROCEED" }), false);
});

test("client cannot change Proceed to Do-not-proceed afterward", () => {
  assert.equal(canRecordClientDecision({ ...validDecision, existingDecision: "PROCEED", agreementExists: true }), false);
});

test("Do-not-proceed works before a decision and creates no remaining-payment obligation", () => {
  assert.equal(canRecordClientDecision(validDecision), true);
  const evidence = buildDoNotProceedDecisionEvidence(new Date("2030-01-02T10:00:00.000Z"));
  assert.equal(evidence.decision, "DO_NOT_PROCEED");
  assert.equal(evidence.financialObligationConfirmed, false);
  assert.equal(decisionCreatesFinancialObligation(evidence.decision), false);
  assert.equal("remainingAmountAcknowledged" in evidence, false);
});

test("professional and non-owner cannot submit the client agreement", () => {
  assert.equal(canRecordClientDecision({ ...validDecision, userRole: "PROFESSIONAL" }), false);
  assert.equal(canRecordClientDecision({ ...validDecision, userId: "different-client" }), false);
});

test("historical decisions without a new evidence record remain readable", () => {
  assert.equal(historicalDecisionIsReadable("PROCEED", false), true);
  assert.equal(historicalDecisionIsReadable("DO_NOT_PROCEED", false), true);
  assert.equal(historicalDecisionIsReadable(null, false), false);
});
