import type { SignatureAsset } from "../types";
import { useImageAssets, type StoredImageAsset } from "./useImageAssets";

/** Legacy alias kept for callers that imported this from useSignatures. */
export type StoredSignature = StoredImageAsset;

type Options = {
  onInitialLoad?: (signatures: SignatureAsset[]) => void;
};

/**
 * Persistent list of imported signatures. Thin wrapper over
 * `useImageAssets` ; see that hook for the persistence contract.
 */
export function useSignatures({ onInitialLoad }: Options = {}) {
  return useImageAssets({
    loadCommand: "load_signatures",
    saveCommand: "save_signatures",
    saveArgName: "signatures",
    label: "signatures",
    onInitialLoad
  });
}
