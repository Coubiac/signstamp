import { describe, expect, it } from "vitest";
import { parseHexColor, toCssRgba } from "./color";

describe("parseHexColor", () => {
  it("parses a 6-digit hex with the '#' prefix", () => {
    expect(parseHexColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses a 6-digit hex without the '#' prefix", () => {
    expect(parseHexColor("00ff00")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("is case-insensitive", () => {
    expect(parseHexColor("#AB12cd")).toEqual({ r: 171, g: 18, b: 205 });
  });

  it("trims surrounding whitespace", () => {
    expect(parseHexColor("  #fde047  ")).toEqual({ r: 253, g: 224, b: 71 });
  });

  it("returns null for a 3-digit hex", () => {
    expect(parseHexColor("#fff")).toBeNull();
  });

  it("returns null for non-hex characters of the right length", () => {
    expect(parseHexColor("#xyzabc")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseHexColor("")).toBeNull();
  });

  it("returns null for the standalone '#'", () => {
    expect(parseHexColor("#")).toBeNull();
  });
});

describe("toCssRgba", () => {
  it("formats channels with an alpha value", () => {
    expect(toCssRgba({ r: 12, g: 34, b: 56 }, 0.5)).toBe("rgba(12, 34, 56, 0.5)");
  });

  it("preserves zero channels and fully opaque alpha", () => {
    expect(toCssRgba({ r: 0, g: 0, b: 0 }, 1)).toBe("rgba(0, 0, 0, 1)");
  });

  it("preserves the maximum channel values", () => {
    expect(toCssRgba({ r: 255, g: 255, b: 255 }, 0)).toBe("rgba(255, 255, 255, 0)");
  });
});
