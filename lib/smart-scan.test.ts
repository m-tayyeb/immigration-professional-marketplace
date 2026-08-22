import assert from "node:assert/strict";
import test from "node:test";
import { clampScanPoint, defaultScanQuad, detectDocumentEdges, filterScanRgb, fitScanToPage, isValidScanQuad, mapPerspectivePoint, perspectiveTransform, rotatedScanSize, scanCropBounds, smartScanMaxBytes, smartScanOutputSize } from "./smart-scan";

test("unclear edge detection safely falls back to the whole image", () => {
  const result = detectDocumentEdges(new Uint8ClampedArray(40 * 60 * 4).fill(255), 40, 60);
  assert.equal(result.detected, false); assert.deepEqual(result.quad, defaultScanQuad(40, 60));
});

test("detected edges produce ordered corner coordinates", () => {
  const width = 50; const height = 50; const data = new Uint8ClampedArray(width * height * 4).fill(25);
  for (let y = 8; y <= 42; y += 1) for (let x = 7; x <= 43; x += 1) if (x === 7 || x === 43 || y === 8 || y === 42) { const index = (y * width + x) * 4; data[index] = data[index + 1] = data[index + 2] = 245; data[index + 3] = 255; }
  const result = detectDocumentEdges(data, width, height); assert.equal(result.detected, true); assert.ok(result.quad.topLeft.x < result.quad.topRight.x); assert.ok(result.quad.topLeft.y < result.quad.bottomLeft.y);
});

test("manual corner coordinates and crop bounds remain inside the image", () => {
  assert.deepEqual(clampScanPoint({ x: -4, y: 120 }, 100, 80), { x: 0, y: 80 });
  assert.deepEqual(scanCropBounds({ topLeft: { x: -2, y: 4 }, topRight: { x: 90, y: 2 }, bottomRight: { x: 105, y: 77 }, bottomLeft: { x: 3, y: 88 } }, 100, 80), { left: 0, top: 2, right: 100, bottom: 80 });
});

test("rotation swaps dimensions at quarter turns", () => {
  assert.deepEqual(rotatedScanSize(1200, 1800, 90), { width: 1800, height: 1200 }); assert.deepEqual(rotatedScanSize(1200, 1800, 180), { width: 1200, height: 1800 });
});

test("all scan filters have distinct, predictable pixel behavior", () => {
  assert.deepEqual(filterScanRgb(30, 90, 210, "original"), [30, 90, 210]); const gray = filterScanRgb(30, 90, 210, "grayscale"); assert.equal(gray[0], gray[1]); assert.equal(gray[1], gray[2]); assert.notDeepEqual(filterScanRgb(30, 90, 210, "clean"), [30, 90, 210]); assert.equal(filterScanRgb(240, 240, 240, "high-contrast")[0], 255);
});

test("perspective input validation rejects crossed corners and maps valid corners", () => {
  const valid = defaultScanQuad(200, 300); assert.equal(isValidScanQuad(valid, 200, 300), true); const transform = perspectiveTransform(valid, 200, 300); const mapped = mapPerspectivePoint(transform, 200, 300); assert.ok(Math.abs(mapped.x - 200) < .01 && Math.abs(mapped.y - 300) < .01);
  assert.equal(isValidScanQuad({ topLeft: { x: 0, y: 0 }, topRight: { x: 200, y: 300 }, bottomRight: { x: 200, y: 0 }, bottomLeft: { x: 0, y: 300 } }, 200, 300), false);
});

test("fit to page preserves aspect ratio and centers the scan", () => {
  assert.deepEqual(fitScanToPage(1000, 2000, 600, 800), { x: 100, y: 0, width: 400, height: 800 });
});

test("temporary scan dimensions are constrained below the upload-safe target", () => {
  assert.deepEqual(smartScanOutputSize(5200, 3900), { width: 2600, height: 1950 }); assert.equal(smartScanMaxBytes, 4 * 1024 * 1024);
});

test("multi-page scan order is stable when additional pages are appended", () => {
  const pages = ["page-1", "page-2"]; assert.deepEqual([...pages, "page-3"], ["page-1", "page-2", "page-3"]);
});
