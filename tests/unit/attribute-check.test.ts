import { describe, it, expect } from "vitest";
import {
  getMissingAttributes,
  type AttributeDefinitionLike,
  type MemberAttributeValueLike,
} from "@/lib/utils/attribute-check";

describe("getMissingAttributes", () => {
  const defs: AttributeDefinitionLike[] = [
    {
      id: "d1",
      name: "gender",
      label: "Gender",
      type: "SELECT",
      required: true,
      options: ["M", "F", "X"],
    },
    { id: "d2", name: "bio", label: "Bio", type: "TEXT", required: false },
    {
      id: "d3",
      name: "canDrive",
      label: "Can Drive",
      type: "BOOLEAN",
      required: true,
    },
  ];

  it("returns required definitions with no value", () => {
    const values: MemberAttributeValueLike[] = [];
    const missing = getMissingAttributes(defs, values);
    expect(missing).toHaveLength(2);
    expect(missing.map((m) => m.name)).toEqual(["gender", "canDrive"]);
  });

  it("excludes optional definitions", () => {
    const values: MemberAttributeValueLike[] = [];
    const missing = getMissingAttributes(defs, values);
    expect(missing.find((m) => m.name === "bio")).toBeUndefined();
  });

  it("excludes definitions that have a value", () => {
    const values: MemberAttributeValueLike[] = [
      { definition: { name: "gender" }, value: '"M"' },
      { definition: { name: "canDrive" }, value: "true" },
    ];
    const missing = getMissingAttributes(defs, values);
    expect(missing).toHaveLength(0);
  });

  it("treats empty string as missing", () => {
    const values: MemberAttributeValueLike[] = [
      { definition: { name: "gender" }, value: '""' },
    ];
    const missing = getMissingAttributes(defs, values);
    expect(missing.map((m) => m.name)).toContain("gender");
  });

  it("treats empty array as missing", () => {
    const values: MemberAttributeValueLike[] = [
      { definition: { name: "gender" }, value: "[]" },
    ];
    const missing = getMissingAttributes(defs, values);
    expect(missing.map((m) => m.name)).toContain("gender");
  });
});
