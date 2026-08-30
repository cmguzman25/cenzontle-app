"use client";

import type { TextSelection } from "@/components/Transcript";

type Props = {
  selection: TextSelection;
  /** Si el texto sombreado ya está en el banco. */
  saved: boolean;
  onSave: () => void;
  onRemove: () => void;
};

export default function SelectionPopover({
  selection,
  saved,
  onSave,
  onRemove,
}: Props) {
  const { text, rect } = selection;

  // Centramos el botón sobre el texto, sin salirnos de la pantalla.
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - 90),
    (typeof window !== "undefined" ? window.innerWidth : 1024) - 188,
  );
  const top = Math.max(8, rect.top - 46);

  return (
    <div
      style={{ position: "fixed", top, left, zIndex: 50 }}
      // `mousedown` se dispara antes de que el navegador borre la selección.
      onMouseDown={(event) => {
        event.preventDefault();
        if (saved) onRemove();
        else onSave();
      }}
      className="animate-in cursor-pointer select-none rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
    >
      {saved ? "✕ Quitar del banco" : "➕ Guardar"}{" "}
      <span className="opacity-70">
        «{text.length > 24 ? `${text.slice(0, 24)}…` : text}»
      </span>
    </div>
  );
}
