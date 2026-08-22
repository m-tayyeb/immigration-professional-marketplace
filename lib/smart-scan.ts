export type ScanPoint = { x: number; y: number };
export type ScanQuad = { topLeft: ScanPoint; topRight: ScanPoint; bottomRight: ScanPoint; bottomLeft: ScanPoint };
export type ScanFilter = "original" | "clean" | "grayscale" | "high-contrast";

export const smartScanMaxDimension = 2600;
export const smartScanMaxBytes = 4 * 1024 * 1024;

export function defaultScanQuad(width: number, height: number): ScanQuad {
  return { topLeft: { x: 0, y: 0 }, topRight: { x: width, y: 0 }, bottomRight: { x: width, y: height }, bottomLeft: { x: 0, y: height } };
}

export function clampScanPoint(point: ScanPoint, width: number, height: number): ScanPoint {
  return { x: Math.max(0, Math.min(width, point.x)), y: Math.max(0, Math.min(height, point.y)) };
}

const cross = (a: ScanPoint, b: ScanPoint, c: ScanPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export function isValidScanQuad(quad: ScanQuad, width: number, height: number) {
  const points = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft].map((point) => clampScanPoint(point, width, height));
  const turns = points.map((point, index) => cross(point, points[(index + 1) % 4], points[(index + 2) % 4]));
  const area = Math.abs(points.reduce((sum, point, index) => sum + point.x * points[(index + 1) % 4].y - points[(index + 1) % 4].x * point.y, 0) / 2);
  return area >= Math.max(400, width * height * .01) && (turns.every((value) => value > 0) || turns.every((value) => value < 0));
}

export function scanCropBounds(quad: ScanQuad, width: number, height: number) {
  const points = Object.values(quad).map((point) => clampScanPoint(point, width, height));
  const xs = points.map((point) => point.x); const ys = points.map((point) => point.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

export function rotatedScanSize(width: number, height: number, rotation: number) {
  return Math.abs(rotation % 180) === 90 ? { width: height, height: width } : { width, height };
}

export function fitScanToPage(imageWidth: number, imageHeight: number, pageWidth: number, pageHeight: number) {
  const scale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
  const width = imageWidth * scale; const height = imageHeight * scale;
  return { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height };
}

export function smartScanOutputSize(width: number, height: number, maxDimension = smartScanMaxDimension) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function filterScanRgb(red: number, green: number, blue: number, filter: ScanFilter): [number, number, number] {
  if (filter === "original") return [red, green, blue]; const gray = red * .299 + green * .587 + blue * .114;
  if (filter === "grayscale") return [gray, gray, gray]; if (filter === "high-contrast") { const value = gray > 150 ? 255 : Math.max(0, gray * .72); return [value, value, value]; }
  return [Math.min(255, Math.max(0, (red - 118) * 1.12 + 132)), Math.min(255, Math.max(0, (green - 118) * 1.12 + 132)), Math.min(255, Math.max(0, (blue - 118) * 1.12 + 132))];
}

export function detectDocumentEdges(data: Uint8ClampedArray, width: number, height: number): { quad: ScanQuad; detected: boolean } {
  if (width < 3 || height < 3 || data.length < width * height * 4) return { quad: defaultScanQuad(width, height), detected: false };
  const gray = new Uint8Array(width * height);
  for (let index = 0; index < gray.length; index += 1) gray[index] = Math.round(data[index * 4] * .299 + data[index * 4 + 1] * .587 + data[index * 4 + 2] * .114);
  let sum = 0; let count = 0;
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) { const index = y * width + x; sum += Math.abs(gray[index + 1] - gray[index - 1]) + Math.abs(gray[index + width] - gray[index - width]); count += 1; }
  const threshold = Math.max(28, sum / Math.max(1, count) * 2.2);
  let left = width; let top = height; let right = -1; let bottom = -1; let hits = 0;
  for (let y = 2; y < height - 2; y += 1) for (let x = 2; x < width - 2; x += 1) { const index = y * width + x; const edge = Math.abs(gray[index + 1] - gray[index - 1]) + Math.abs(gray[index + width] - gray[index - width]); if (edge >= threshold) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); hits += 1; } }
  const area = right > left && bottom > top ? (right - left) * (bottom - top) : 0;
  const detected = hits >= 12 && area >= width * height * .08;
  return detected ? { detected, quad: { topLeft: { x: left, y: top }, topRight: { x: right, y: top }, bottomRight: { x: right, y: bottom }, bottomLeft: { x: left, y: bottom } } } : { detected: false, quad: defaultScanQuad(width, height) };
}

function solve(matrix: number[][], values: number[]) {
  const size = values.length; const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) { let pivot = column; for (let row = column + 1; row < size; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row; [rows[column], rows[pivot]] = [rows[pivot], rows[column]]; if (Math.abs(rows[column][column]) < 1e-8) throw new Error("INVALID_PERSPECTIVE"); const divisor = rows[column][column]; for (let item = column; item <= size; item += 1) rows[column][item] /= divisor; for (let row = 0; row < size; row += 1) if (row !== column) { const factor = rows[row][column]; for (let item = column; item <= size; item += 1) rows[row][item] -= factor * rows[column][item]; } }
  return rows.map((row) => row[size]);
}

export function perspectiveTransform(quad: ScanQuad, outputWidth: number, outputHeight: number) {
  if (!isValidScanQuad(quad, Math.max(quad.topRight.x, quad.bottomRight.x), Math.max(quad.bottomLeft.y, quad.bottomRight.y)) || outputWidth < 1 || outputHeight < 1) throw new Error("INVALID_PERSPECTIVE");
  const source = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft]; const destination = [{ x: 0, y: 0 }, { x: outputWidth, y: 0 }, { x: outputWidth, y: outputHeight }, { x: 0, y: outputHeight }]; const matrix: number[][] = []; const values: number[] = [];
  for (let index = 0; index < 4; index += 1) { const d = destination[index]; const s = source[index]; matrix.push([d.x, d.y, 1, 0, 0, 0, -s.x * d.x, -s.x * d.y]); values.push(s.x); matrix.push([0, 0, 0, d.x, d.y, 1, -s.y * d.x, -s.y * d.y]); values.push(s.y); }
  return solve(matrix, values);
}

export function mapPerspectivePoint(transform: number[], x: number, y: number): ScanPoint {
  const denominator = transform[6] * x + transform[7] * y + 1;
  return { x: (transform[0] * x + transform[1] * y + transform[2]) / denominator, y: (transform[3] * x + transform[4] * y + transform[5]) / denominator };
}
