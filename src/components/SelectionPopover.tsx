"use client";

import type { TextSelection } from "@/components/Transcript";

/** Ancho aproximado del botón, para no dejarlo medio fuera de la pantalla. */
const WIDTH = 180;

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
  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
  const screenHeight = typeof window !== "undefined" ? window.innerHeight : 768;

  // En el móvil el navegador saca su propio menú (Copiar, Buscar…) justo encima
  // de lo sombreado, y ahí el botón quedaba tapado. Con dedo lo ponemos debajo.
  const touch =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  const below = rect.top + rect.height + 12;
  const above = rect.top - 46;
  // Debajo si es un móvil y cabe; si no, encima, y siempre dentro de pantalla.
  const top =
    touch && below < screenHeight - 56
      ? below
      : Math.max(8, above < 8 ? below : above);

  // Centramos el botón sobre el texto, sin salirnos de la pantalla.
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - WIDTH / 2),
    Math.max(8, screenWidth - WIDTH - 8),
  );

  /** Guardar o quitar. Va en `pointerdown`, antes de perder lo sombreado. */
  function apply(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (saved) onRemove();
    else onSave();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      style={{ position: "fixed", top, left, touchAction: "manipulation" }}
      // `pointerdown` cubre ratón y dedo, y se dispara antes de que el
      // navegador borre la selección (que es lo que necesitamos guardar).
      onPointerDown={apply}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") apply(event);
      }}
      className="animate-in z-50 cursor-pointer select-none rounded-lg bg-neutral-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
    >
      {saved ? "✕ Quitar del banco" : "➕ Guardar"}{" "}
      <span className="opacity-70">
        «{text.length > 20 ? `${text.slice(0, 20)}…` : text}»
      </span>
    </div>
  );
}
