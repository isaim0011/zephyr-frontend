import { describe, expect, it } from "vitest";
import { calculateFee, compare, fromStroops, isValidAmount, quote, toStroops } from "@/lib/amount";

describe("amount math (mirrors zephyr-backend)", () => {
  it("round-trips 7-decimal amounts exactly", () => {
    expect(fromStroops(toStroops("0.1234567"))).toBe("0.1234567");
    expect(fromStroops(toStroops("10"))).toBe("10.00");
    expect(fromStroops(-15n)).toBe("-0.0000015");
  });

  it("computes the same fees as the backend", () => {
    // Same cases as zephyr-backend/test/amount.test.ts.
    expect(calculateFee("100", "0.50", "1")).toBe("1.50");
    expect(calculateFee("33.33", "0", "1")).toBe("0.33");
    expect(calculateFee("10", "0.25", "0.3")).toBe("0.28");
    expect(calculateFee("250", "0.50", "1")).toBe("3.00");
  });

  it("quotes what the user receives", () => {
    expect(quote("100", { fixed: "0.50", percent: "1" })).toEqual({ fee: "1.50", receive: "98.50", coversFee: true });
    expect(quote("0.4", { fixed: "0.50", percent: "1" })).toMatchObject({ receive: "0.00", coversFee: false });
    expect(quote("abc", { fixed: "0.50", percent: "1" })).toBeNull();
  });

  it("rejects malformed amounts and percents", () => {
    expect(isValidAmount("1e5")).toBe(false);
    expect(() => toStroops("-1")).toThrow();
    expect(() => toStroops("1.12345678")).toThrow();
    expect(() => calculateFee("1", "0", "1.23456")).toThrow();
  });

  it("compares", () => {
    expect(compare("1.0", "1")).toBe(0);
    expect(compare("2", "10")).toBe(-1);
    expect(compare("10", "2")).toBe(1);
  });
});
