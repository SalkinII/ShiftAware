import { describe, it, expect } from "vitest";
import {
  getValidOperators,
  isBalanceModeAvailable,
} from "../../../lib/algorithm/rule-compatibility";

describe("getValidOperators", () => {
  it("BOOLEAN FILTER: EQUALS, NOT_EQUALS only", () => {
    expect(getValidOperators("BOOLEAN", "FILTER")).toEqual(["EQUALS", "NOT_EQUALS"]);
  });

  it("SELECT FILTER: EQUALS, NOT_EQUALS, ONE_OF", () => {
    expect(getValidOperators("SELECT", "FILTER")).toEqual(["EQUALS", "NOT_EQUALS", "ONE_OF"]);
  });

  it("MULTISELECT FILTER: CONTAINS, ONE_OF", () => {
    expect(getValidOperators("MULTISELECT", "FILTER")).toEqual(["CONTAINS", "ONE_OF"]);
  });

  it("TEXT FILTER: EQUALS, NOT_EQUALS, CONTAINS", () => {
    expect(getValidOperators("TEXT", "FILTER")).toEqual(["EQUALS", "NOT_EQUALS", "CONTAINS"]);
  });

  it("SELECT BALANCE: same operators as FILTER", () => {
    expect(getValidOperators("SELECT", "BALANCE")).toEqual(["EQUALS", "NOT_EQUALS", "ONE_OF"]);
  });

  it("MULTISELECT BALANCE: same operators as FILTER", () => {
    expect(getValidOperators("MULTISELECT", "BALANCE")).toEqual(["CONTAINS", "ONE_OF"]);
  });

  it("BOOLEAN BALANCE: returns empty (not available for balance)", () => {
    expect(getValidOperators("BOOLEAN", "BALANCE")).toEqual([]);
  });

  it("TEXT BALANCE: returns empty (not available for balance)", () => {
    expect(getValidOperators("TEXT", "BALANCE")).toEqual([]);
  });

  it("unknown type: returns empty", () => {
    expect(getValidOperators("UNKNOWN" as any, "FILTER")).toEqual([]);
  });
});

describe("isBalanceModeAvailable", () => {
  it("available for SELECT", () => {
    expect(isBalanceModeAvailable("SELECT")).toBe(true);
  });

  it("available for MULTISELECT", () => {
    expect(isBalanceModeAvailable("MULTISELECT")).toBe(true);
  });

  it("not available for BOOLEAN", () => {
    expect(isBalanceModeAvailable("BOOLEAN")).toBe(false);
  });

  it("not available for TEXT", () => {
    expect(isBalanceModeAvailable("TEXT")).toBe(false);
  });
});
