import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { DEFAULT_TEXT_STYLE, useTextStyle, type TextStyle } from "./useTextStyle";

type Handle = ReturnType<typeof useTextStyle>;

function renderHook(initial?: TextStyle) {
  let latest: Handle | null = null;
  function Probe() {
    latest = useTextStyle(initial);
    return null;
  }
  const utils = render(<Probe />);
  return {
    ...utils,
    get current() { return latest!; }
  };
}

afterEach(() => {
  cleanup();
});

describe("useTextStyle", () => {
  it("starts at DEFAULT_TEXT_STYLE when no initial value is provided", () => {
    const h = renderHook();
    expect(h.current[0]).toEqual(DEFAULT_TEXT_STYLE);
  });

  it("accepts a custom initial style", () => {
    const initial: TextStyle = { fontSize: 22, fontFamily: "serif", bold: true, underline: false, strike: true };
    const h = renderHook(initial);
    expect(h.current[0]).toEqual(initial);
  });

  it("merges partial updates without touching unrelated fields", () => {
    const h = renderHook();
    act(() => { h.current[1]({ fontSize: 18 }); });
    expect(h.current[0]).toEqual({ ...DEFAULT_TEXT_STYLE, fontSize: 18 });
  });

  it("supports multiple successive updates", () => {
    const h = renderHook();
    act(() => { h.current[1]({ bold: true }); });
    act(() => { h.current[1]({ underline: true }); });
    act(() => { h.current[1]({ fontFamily: "mono" }); });
    expect(h.current[0]).toEqual({
      ...DEFAULT_TEXT_STYLE,
      bold: true,
      underline: true,
      fontFamily: "mono"
    });
  });

  it("can apply a full sync (e.g. when selecting another text item) in one call", () => {
    const h = renderHook();
    act(() => {
      h.current[1]({
        fontSize: 32,
        fontFamily: "mono",
        bold: true,
        underline: true,
        strike: true
      });
    });
    expect(h.current[0]).toEqual({
      fontSize: 32,
      fontFamily: "mono",
      bold: true,
      underline: true,
      strike: true
    });
  });
});
