import assert from "node:assert/strict";
import test from "node:test";
import { acceptedStudioFiles, evaluatePdfOptimization, hasDocumentStudioEntitlement, invalidateGeneratedPdf, isStudioDocumentType, mergeReceivedItemIds, replaceStudioWorkspaceFile, selectedStudioPdf, shortCaseReference, studioCaseLabel, validateStudioFile } from "./document-studio";

test("Document Studio requires a paid assessment", () => {
  assert.equal(hasDocumentStudioEntitlement([{ stage: "ASSESSMENT", status: "PAID" }]), true);
  assert.equal(hasDocumentStudioEntitlement([{ stage: "ASSESSMENT", status: "PENDING" }]), false);
});
test("studio case labels show the authorized viewer the expected identity details", () => {
  const item = { id: "case_abc1042", service: "First Residence Permit", clientName: "Iqra Ijaz" };
  assert.equal(studioCaseLabel(item, "PROFESSIONAL"), `Iqra Ijaz — First Residence Permit — ${shortCaseReference(item.id)}`);
  assert.equal(studioCaseLabel(item, "CLIENT"), `First Residence Permit — ${shortCaseReference(item.id)}`);
});
test("received transfer items preserve order and are not duplicated", () => {
  assert.deepEqual(mergeReceivedItemIds(["page-1"], ["page-1", "page-2", "page-3"]), ["page-1", "page-2", "page-3"]);
});
test("studio save metadata accepts only supported document types", () => {
  assert.equal(isStudioDocumentType("Passport"), true);
  assert.equal(isStudioDocumentType("Untrusted type"), false);
});
test("source changes invalidate the previously generated PDF", () => {
  assert.equal(invalidateGeneratedPdf<{ name: string }>(), null);
});
test("optimization keeps the original selected until the user explicitly chooses optimized", () => {
  const original = { name: "original" }; const optimized = { name: "optimized" };
  assert.equal(selectedStudioPdf(original, optimized, "original"), original);
  assert.equal(selectedStudioPdf(original, optimized, "optimized"), optimized);
});
test("the original remains available when no optimized output exists", () => {
  const original = { name: "original" };
  assert.equal(selectedStudioPdf(original, null, "optimized"), original);
});
test("optimization candidates that are equal or larger are rejected", () => {
  assert.deepEqual(evaluatePdfOptimization(1000, 1100), { accepted: false, savedPercent: 0 });
  assert.deepEqual(evaluatePdfOptimization(1000, 1000), { accepted: false, savedPercent: 0 });
  assert.deepEqual(evaluatePdfOptimization(1000, 580), { accepted: true, savedPercent: 42 });
});
test("source invalidation clears generated and optimized output slots", () => {
  assert.deepEqual([invalidateGeneratedPdf<File>(), invalidateGeneratedPdf<File>()], [null, null]);
});
test("Document Studio accepts only safe PDF and image inputs", () => {
  assert.equal(validateStudioFile({ name: "passport.pdf", type: "application/pdf", size: 100 }), true);
  assert.equal(validateStudioFile({ name: "scan.exe", type: "application/pdf", size: 100 }), false);
  assert.equal(validateStudioFile({ name: "scan.png", type: "image/png", size: 11 * 1024 * 1024 }), false);
});
test("a single selected PDF is snapshotted into the workspace", () => {
  const pdf = { name: "case.pdf", type: "application/pdf", size: 100 };
  assert.deepEqual(acceptedStudioFiles({ 0: pdf, length: 1 }), [pdf]);
});
test("multiple selected PDF, JPG and PNG files are all accepted", () => {
  const files = [{ name: "case.pdf", type: "application/pdf", size: 100 }, { name: "photo.jpg", type: "image/jpeg", size: 200 }, { name: "scan.png", type: "image/png", size: 300 }];
  assert.deepEqual(acceptedStudioFiles(files), files);
});
test("resetting the input after snapshot does not discard accepted files", () => {
  const pdf = { name: "case.pdf", type: "application/pdf", size: 100 }; const live = { 0: pdf, length: 1 };
  const snapshot = acceptedStudioFiles(live); live.length = 0;
  assert.deepEqual(snapshot, [pdf]);
});
test("applying PDF changes replaces one workspace item and preserves its original internally", () => {
  const original = new File(["original"], "original.pdf", { type: "application/pdf" }); const edited = new File(["edited"], "edited.pdf", { type: "application/pdf" });
  const result = replaceStudioWorkspaceFile([{ id: "one", file: original }, { id: "two", file: original }], 0, edited);
  assert.equal(result.length, 2); assert.equal(result[0].file, edited); assert.equal(result[0].originalFile, original); assert.equal(result[1].file, original);
});
