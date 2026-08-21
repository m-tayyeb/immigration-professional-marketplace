import assert from "node:assert/strict";
import test from "node:test";
import { hasDocumentStudioEntitlement, validateStudioFile } from "./document-studio";

test("Document Studio requires a paid assessment", () => {
  assert.equal(hasDocumentStudioEntitlement([{ stage: "ASSESSMENT", status: "PAID" }]), true);
  assert.equal(hasDocumentStudioEntitlement([{ stage: "ASSESSMENT", status: "PENDING" }]), false);
});
test("Document Studio accepts only safe PDF and image inputs", () => {
  assert.equal(validateStudioFile({ name: "passport.pdf", type: "application/pdf", size: 100 }), true);
  assert.equal(validateStudioFile({ name: "scan.exe", type: "application/pdf", size: 100 }), false);
  assert.equal(validateStudioFile({ name: "scan.png", type: "image/png", size: 11 * 1024 * 1024 }), false);
});
