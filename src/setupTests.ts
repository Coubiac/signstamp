import "@testing-library/jest-dom/vitest";

if (!globalThis.crypto) {
  // eslint-disable-next-line no-global-assign
  (globalThis as any).crypto = {};
}

if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => "00000000-0000-0000-0000-000000000000";
}

// jsdom's File does not implement arrayBuffer(); shim it with the
// FileReader API that jsdom already supports so utils/file.ts can be
// tested without a real browser.
if (typeof File !== "undefined" && !File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
