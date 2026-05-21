import type { PointerEvent as ReactPointerEvent } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import type { Item, SignatureAsset } from "../../types";
import { SignatureOverlay } from "./SignatureOverlay";
import { CheckOverlay } from "./CheckOverlay";
import { EllipseOverlay } from "./EllipseOverlay";
import { HighlightOverlay } from "./HighlightOverlay";
import { LineOverlay } from "./LineOverlay";
import { ArrowOverlay } from "./ArrowOverlay";
import { TextOverlay } from "./TextOverlay";

/**
 * Editing-related bag of props, only consumed by `TextOverlay`. The
 * dispatcher forwards it as-is so each overlay component stays
 * focused on a single item type.
 */
export type TextEditingProps = {
  isActive: boolean;
  value: string;
  placeholder: string;
  title: string;
  onStart: () => void;
  onChange: (value: string) => void;
  onCommit: (apply: boolean) => void;
};

type Props = {
  item: Item;
  viewport: PageViewport;
  isSelected: boolean;
  signatures: SignatureAsset[];
  textEditing: TextEditingProps;
  onStartMove: (e: ReactPointerEvent) => void;
  onStartResize: (e: ReactPointerEvent) => void;
};

/**
 * Render the right overlay for the discriminated `Item` union.
 * All shared concerns (selection state, move/resize callbacks) are
 * passed through. The dispatcher resolves the signature asset for
 * signature items so child components stay decoupled from the
 * signatures list.
 */
export function ItemOverlay({ item, viewport, isSelected, signatures, textEditing, onStartMove, onStartResize }: Props) {
  switch (item.type) {
    case "signature":
      return (
        <SignatureOverlay
          item={item}
          viewport={viewport}
          isSelected={isSelected}
          signature={signatures.find(s => s.id === item.signatureId) ?? null}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
        />
      );
    case "check":
      return (
        <CheckOverlay
          item={item}
          viewport={viewport}
          isSelected={isSelected}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
        />
      );
    case "ellipse":
      return (
        <EllipseOverlay
          item={item}
          viewport={viewport}
          isSelected={isSelected}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
        />
      );
    case "highlight":
      return (
        <HighlightOverlay
          item={item}
          viewport={viewport}
          isSelected={isSelected}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
        />
      );
    case "line":
      return (
        <LineOverlay
          item={item}
          viewport={viewport}
          isSelected={isSelected}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
        />
      );
    case "arrow":
      return (
        <ArrowOverlay
          item={item}
          viewport={viewport}
          isSelected={isSelected}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
        />
      );
    case "text":
      return (
        <TextOverlay
          item={item}
          viewport={viewport}
          isSelected={isSelected}
          isEditing={textEditing.isActive}
          editingValue={textEditing.value}
          placeholder={textEditing.placeholder}
          editTitle={textEditing.title}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          onStartEdit={textEditing.onStart}
          onEditChange={textEditing.onChange}
          onCommit={textEditing.onCommit}
        />
      );
  }
}
