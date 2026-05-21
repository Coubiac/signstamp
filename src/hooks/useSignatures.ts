import { useMemo } from "react";
import type { SignatureAsset } from "../types";
import { bytesToDataUrl } from "../utils/file";
import { usePersistentState } from "./usePersistentState";
import { tauriOnlyAdapter } from "./storageAdapters";

/**
 * On-disk shape of a signature. Bytes are stored as a plain number
 * array so the JSON serializer used by the Tauri command does not
 * have to special-case Uint8Array.
 */
export type StoredSignature = {
  id: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  bytes: number[];
  naturalW: number;
  naturalH: number;
};

type Options = {
  /**
   * Called once after the first load completes, with the hydrated
   * signatures. Lets the host component pick an initial selection.
   */
  onInitialLoad?: (signatures: SignatureAsset[]) => void;
};

/**
 * Persisted list of imported signatures, available only inside the
 * Tauri desktop shell (the byte payloads are too large to keep in
 * localStorage). Hydration regenerates the data URL preview from the
 * stored bytes so the rest of the app can keep treating signatures
 * as immutable `SignatureAsset` records.
 */
export function useSignatures({ onInitialLoad }: Options = {}) {
  const adapter = useMemo(() => tauriOnlyAdapter<StoredSignature[]>({
    loadCommand: "load_signatures",
    saveCommand: "save_signatures",
    saveArgName: "signatures"
  }), []);

  return usePersistentState<SignatureAsset[], StoredSignature[]>({
    adapter,
    defaultValue: [],
    hydrate: async (stored) => Promise.all(stored.map(async (sig) => {
      const bytes = new Uint8Array(sig.bytes);
      const dataUrl = await bytesToDataUrl(bytes, sig.mime);
      return {
        id: sig.id,
        name: sig.name,
        mime: sig.mime,
        bytes,
        dataUrl,
        naturalW: sig.naturalW,
        naturalH: sig.naturalH
      } satisfies SignatureAsset;
    })),
    dehydrate: (signatures) => signatures.map((sig) => ({
      id: sig.id,
      name: sig.name,
      mime: sig.mime,
      bytes: Array.from(sig.bytes),
      naturalW: sig.naturalW,
      naturalH: sig.naturalH
    })),
    onLoaded: onInitialLoad,
    label: "signatures"
  });
}
