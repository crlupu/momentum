import { Trash2 } from "./icons";

/**
 * The mark of an icon-only delete: a trash glyph in red, no fill. It sits on
 * the same quiet disc as the other row actions, so a delete stays clear
 * without being the loudest thing on the row. Every icon-only delete uses it.
 */
export function DeleteGlyph({ size = 22 }: { size?: number }) {
  return <Trash2 aria-hidden className="delete-glyph" style={{ inlineSize: size, blockSize: size }} />;
}
