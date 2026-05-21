import { describe, expect, it } from "vitest";
import { bytesToDataUrl, fileToBytes } from "./file";

describe("fileToBytes", () => {
  it("returns the file content as a Uint8Array", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "buffer.bin");
    const bytes = await fileToBytes(file);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it("returns an independent buffer (no aliasing with the input)", async () => {
    const original = new Uint8Array([10, 20, 30]);
    const file = new File([original], "buffer.bin");
    const bytes = await fileToBytes(file);
    bytes[0] = 99;
    expect(original[0]).toBe(10);
  });
});

describe("bytesToDataUrl", () => {
  it("produces a data URL with the given mime type", async () => {
    const bytes = new Uint8Array([72, 105]); // "Hi"
    const url = await bytesToDataUrl(bytes, "text/plain");
    expect(url.startsWith("data:text/plain")).toBe(true);
  });

  it("encodes the payload as base64", async () => {
    const bytes = new Uint8Array([72, 105]); // "Hi" -> base64 "SGk="
    const url = await bytesToDataUrl(bytes, "text/plain");
    expect(url.endsWith(",SGk=")).toBe(true);
  });

  it("copies input so caller mutations do not corrupt the blob", async () => {
    const bytes = new Uint8Array([72, 105]);
    const pending = bytesToDataUrl(bytes, "text/plain");
    bytes[0] = 0; // mutate after handoff
    const url = await pending;
    expect(url.endsWith(",SGk=")).toBe(true);
  });
});
