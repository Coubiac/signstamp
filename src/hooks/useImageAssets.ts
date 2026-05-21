import { useMemo } from "react";
import type { SignatureAsset } from "../types";
import { bytesToDataUrl } from "../utils/file";
import { usePersistentState } from "./usePersistentState";
import { tauriOnlyAdapter } from "./storageAdapters";

/**
 * On-disk shape of an image asset (signatures, paraphs, …). Bytes are
 * stored as a plain number array so the JSON serializer used by the
 * Tauri command does not have to special-case Uint8Array.
 */
export type StoredImageAsset = {
  id: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  bytes: number[];
  naturalW: number;
  naturalH: number;
};

type Options = {
  /** Tauri command pair that loads / saves the asset list. */
  loadCommand: string;
  saveCommand: string;
  /** Argument name expected by the Tauri save command. */
  saveArgName: string;
  /** Debug label routed to the persistent-state hook. */
  label: string;
  /** Called once after first load completes, with the hydrated list. */
  onInitialLoad?: (assets: SignatureAsset[]) => void;
};

/**
 * Persisted list of image assets, available only inside the Tauri
 * desktop shell (the byte payloads are too large to keep in
 * localStorage). Hydration regenerates the data URL preview from the
 * stored bytes so callers can keep treating the records as immutable
 * `SignatureAsset` values.
 */
export function useImageAssets({ loadCommand, saveCommand, saveArgName, label, onInitialLoad }: Options) {
  const adapter = useMemo(() => tauriOnlyAdapter<StoredImageAsset[]>({
    loadCommand,
    saveCommand,
    saveArgName
  }), [loadCommand, saveCommand, saveArgName]);

  return usePersistentState<SignatureAsset[], StoredImageAsset[]>({
    adapter,
    defaultValue: [],
    hydrate: async (stored) => Promise.all(stored.map(async (asset) => {
      const bytes = new Uint8Array(asset.bytes);
      const dataUrl = await bytesToDataUrl(bytes, asset.mime);
      return {
        id: asset.id,
        name: asset.name,
        mime: asset.mime,
        bytes,
        dataUrl,
        naturalW: asset.naturalW,
        naturalH: asset.naturalH
      } satisfies SignatureAsset;
    })),
    dehydrate: (assets) => assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      mime: asset.mime,
      bytes: Array.from(asset.bytes),
      naturalW: asset.naturalW,
      naturalH: asset.naturalH
    })),
    onLoaded: onInitialLoad,
    label
  });
}
