import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  buildErrorMessage,
  buildTimeoutMessage,
  normalizeErrorCode,
  OPERATION_TIMEOUT_MS,
} from "../operationMessages";

describe("operationMessages", () => {
  it("timeout is 30 seconds", () => {
    expect(OPERATION_TIMEOUT_MS).toBe(30_000);
  });

  it("prefers server message and names the operation", () => {
    const m = buildErrorMessage("削除", "CONFLICT", "先にチームを解散してください。");
    expect(m).toContain("削除");
    expect(m).toContain("先にチームを解散してください。");
  });

  it("falls back to a Japanese message per code", () => {
    expect(buildErrorMessage("停止", "FORBIDDEN")).toContain("権限");
    expect(buildErrorMessage("停止", "NOT_FOUND")).toContain("見つかりません");
    expect(buildTimeoutMessage("停止")).toContain("タイムアウト");
  });

  it("unknown codes map to INTERNAL", () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        const c = normalizeErrorCode(v);
        expect(["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION", "CONFLICT", "INTERNAL"]).toContain(c);
      }),
    );
    expect(normalizeErrorCode("nope")).toBe("INTERNAL");
  });
});
