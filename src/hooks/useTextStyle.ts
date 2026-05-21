import { useCallback, useState } from "react";

/**
 * Typography options applied to text items by the active tool and
 * synced from the currently selected item. The five fields are always
 * read and written together so they live in a single state object.
 */
export type TextStyle = {
  fontSize: number;
  fontFamily: "sans" | "serif" | "mono";
  bold: boolean;
  underline: boolean;
  strike: boolean;
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 12,
  fontFamily: "sans",
  bold: false,
  underline: false,
  strike: false
};

/**
 * Hold the active text-style options, exposing a partial-update setter.
 * Returned as a `[value, update]` tuple to match React's `useState`
 * idiom — callers can destructure with their own names.
 */
export function useTextStyle(initial: TextStyle = DEFAULT_TEXT_STYLE) {
  const [style, setStyle] = useState<TextStyle>(initial);

  const update = useCallback((partial: Partial<TextStyle>) => {
    setStyle((prev) => ({ ...prev, ...partial }));
  }, []);

  return [style, update] as const;
}
