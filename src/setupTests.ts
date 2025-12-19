import "@testing-library/jest-dom/vitest";

if (!globalThis.crypto) {
  // eslint-disable-next-line no-global-assign
  (globalThis as any).crypto = {};
}

if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => "00000000-0000-0000-0000-000000000000";
}
