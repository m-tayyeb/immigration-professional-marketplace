export type PdfPageSelection = { sourceIndex: number; rotation: number };

export function parsePdfPageSelection(value: string, pageCount: number) {
  const result: number[] = [];
  const seen = new Set<number>();
  for (const part of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`Invalid page selection: ${part}`);
    const start = Number(match[1]); const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > pageCount) throw new Error(`Page selection must be between 1 and ${pageCount}.`);
    for (let page = start; page <= end; page += 1) if (!seen.has(page - 1)) { seen.add(page - 1); result.push(page - 1); }
  }
  if (!result.length) throw new Error("Select at least one page.");
  return result;
}

export function movePdfPage(pages: readonly number[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= pages.length) return [...pages];
  const next = [...pages]; [next[index], next[target]] = [next[target], next[index]]; return next;
}

export function removePdfPage(pages: readonly number[], index: number) {
  return pages.filter((_, pageIndex) => pageIndex !== index);
}

export function normalizedPlacement(input: { page: number; xPercent: number; yPercent: number; widthPercent: number }) {
  return { pageIndex: Math.max(0, input.page - 1), x: Math.min(100, Math.max(0, input.xPercent)) / 100, y: Math.min(100, Math.max(0, input.yPercent)) / 100, width: Math.min(100, Math.max(1, input.widthPercent)) / 100 };
}
