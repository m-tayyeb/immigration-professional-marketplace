import assert from "node:assert/strict";
import test from "node:test";
import { canConfirmRequestedDocuments, canRequestRemainingPayment, completedChecklistTitleAfterPayment, requestedDocumentsReceivedTitle, statusAfterPayment } from "./case-workflow";

const readyForDocuments = {
  assessmentPaid: true,
  status: "AWAITING_DOCUMENTS_AND_PAYMENT" as const,
  clientDecision: "PROCEED" as const,
};

test("remaining payment cannot be requested before document confirmation", () => {
  assert.equal(canRequestRemainingPayment({ ...readyForDocuments, requestedDocumentsConfirmed: false }), false);
});

test("document confirmation requires uploaded requested documents", () => {
  assert.equal(canConfirmRequestedDocuments({ title: requestedDocumentsReceivedTitle, clientDocumentCount: 0, status: readyForDocuments.status, clientDecision: readyForDocuments.clientDecision }), false);
});

test("remaining payment can be requested after document confirmation", () => {
  assert.equal(canConfirmRequestedDocuments({ title: requestedDocumentsReceivedTitle, clientDocumentCount: 1, status: readyForDocuments.status, clientDecision: readyForDocuments.clientDecision }), true);
  assert.equal(canRequestRemainingPayment({ ...readyForDocuments, requestedDocumentsConfirmed: true }), true);
});

test("paying the remaining balance moves the case to document review and completes its checklist item", () => {
  assert.equal(statusAfterPayment("REMAINING_BALANCE"), "DOCUMENT_REVIEW");
  assert.equal(completedChecklistTitleAfterPayment("REMAINING_BALANCE"), "Remaining balance paid");
});
