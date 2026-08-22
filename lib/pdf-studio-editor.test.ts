import assert from "node:assert/strict";
import test from "node:test";
import { movePdfPage, normalizedPlacement, parsePdfPageSelection, removePdfPage } from "./pdf-studio-editor";

test("PDF page ranges and individual pages preserve requested order without duplicates", () => {
  assert.deepEqual(parsePdfPageSelection("1-3, 6, 4, 2", 6), [0, 1, 2, 5, 3]);
});
test("PDF pages can be removed and reordered without changing the source", () => {
  const source = [0, 1, 2, 3];
  assert.deepEqual(removePdfPage(source, 1), [0, 2, 3]);
  assert.deepEqual(movePdfPage(source, 2, -1), [0, 2, 1, 3]);
  assert.deepEqual(source, [0, 1, 2, 3]);
});
test("manual text and signature placement is normalized and page-safe", () => {
  assert.deepEqual(normalizedPlacement({ page: 2, xPercent: 125, yPercent: -5, widthPercent: 0 }), { pageIndex: 1, x: 1, y: 0, width: .01 });
});
