import { describe, it, expect } from "vitest";
import { parseCsv, toCsv, detectDelimiter, detectColumns, parseTimeCell } from "./integration-csv";

describe("csv", () => {
  it("round-trips quotes, delimiters and newlines", () => {
    const rows = [["a", 'b;"c"', "line1\nline2"], ["1", "", "x"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("handles BOM and detects delimiter", () => {
    expect(detectDelimiter("\uFEFFa;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a,b,c")).toBe(",");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(parseCsv("\uFEFFref;status\r\nR1;delivered\r\n")).toEqual([["ref", "status"], ["R1", "delivered"]]);
  });
  it("ignores empty lines", () => {
    expect(parseCsv("a,b\n\n1,2\n,\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("blocks spreadsheet formula injection but keeps phones", () => {
    const out = toCsv([["=SUM(A1)", "+212600000000", "@x", "-cmd", "0600000000"]]);
    expect(out.startsWith("'=SUM(A1);+212600000000;'@x;'-cmd;0600000000")).toBe(true);
  });
  it("detects columns by aliases (ar/fr/en)", () => {
    expect(detectColumns(["Référence", "Statut", "Date", "AWB"])).toEqual({ reference: 0, status: 1, time: 2, tracking: 3 });
    expect(detectColumns(["المرجع", "الحالة", "رقم التتبع"])).toEqual({ reference: 0, status: 1, time: -1, tracking: 2 });
    expect(detectColumns(["x", "y"])).toEqual({ reference: -1, status: -1, time: -1, tracking: -1 });
  });
  it("parses dates", () => {
    expect(parseTimeCell("2026-11-20 10:30")?.toISOString()).toBe("2026-11-20T10:30:00.000Z");
    expect(parseTimeCell("20/11/2026 09:05")?.toISOString()).toBe("2026-11-20T09:05:00.000Z");
    expect(parseTimeCell("garbage")).toBeNull();
    expect(parseTimeCell("")).toBeNull();
    expect(parseTimeCell("2999-01-01")).toBeNull();
  });
});