import type { SignatureAsset } from "../types";
import { useImageAssets } from "./useImageAssets";

type Options = {
  onInitialLoad?: (paraphs: SignatureAsset[]) => void;
};

/**
 * Persistent list of imported paraphs (initials applied to every
 * page). Shares the storage shape with signatures — only the on-disk
 * file differs.
 */
export function useParaphAssets({ onInitialLoad }: Options = {}) {
  return useImageAssets({
    loadCommand: "load_paraphs",
    saveCommand: "save_paraphs",
    saveArgName: "paraphs",
    label: "paraphs",
    onInitialLoad
  });
}
