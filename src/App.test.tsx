import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn()
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {}
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  function setLang(value: string) {
    Object.defineProperty(navigator, "language", { value, configurable: true });
    Object.defineProperty(navigator, "languages", { value: [value], configurable: true });
  }

  it("keeps signature import enabled without a PDF", () => {
    setLang("en-US");

    render(<App />);

    const importButton = screen.getByRole("button", { name: "Import signature" });
    expect(importButton).toBeEnabled();
  });

  it("disables export without a PDF", () => {
    setLang("en-US");

    render(<App />);

    const exportButton = screen.getByRole("button", { name: "Export PDF" });
    expect(exportButton).toBeDisabled();
  });
});
