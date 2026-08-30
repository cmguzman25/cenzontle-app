"use client";

import { useEffect, useMemo, useRef } from "react";

import HighlightedText, {
  buildHighlightPattern,
} from "@/components/HighlightedText";
import type { Sentence } from "@/lib/types";

export type TextSelection = {
  text: string;
  sentenceId: number;
  /** Posición en pantalla del texto sombreado. */
  rect: { top: number; left: number; width: number };
};

type Props = {
  sentences: Sentence[];
  activeId: number | null;
  loopId: number | null;
  showEs: boolean;
  autoScroll: boolean;
  savedWords: Set<string>;
  onSelect: (sentence: Sentence) => void;
  onToggleLoop: (id: number) => void;
  /** Se llama al soltar el ratón habiendo sombreado texto. */
  onSelectText: (selection: TextSelection | null) => void;
};

export default function Transcript({
  sentences,
  activeId,
  loopId,
  showEs,
  autoScroll,
  savedWords,
  onSelect,
  onToggleLoop,
  onSelectText,
}: Props) {
  const listRef = useRef<HTMLOListElement>(null);

  // Una sola expresión regular para toda la lista, no una por frase.
  const highlight = useMemo(
    () => buildHighlightPattern(savedWords),
    [savedWords],
  );

  useEffect(() => {
    if (!autoScroll || activeId == null || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-sentence-id="${activeId}"]`,
    );
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId, autoScroll]);

  /** Lee lo que el usuario acaba de sombrear y avisa al componente padre. */
  function readSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      onSelectText(null);
      return;
    }

    const text = selection.toString().trim().replace(/\s+/g, " ");
    // Ni vacío ni un párrafo entero.
    if (!text || text.length > 80) {
      onSelectText(null);
      return;
    }

    const anchor = selection.anchorNode;
    const element =
      anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
    const item = element?.closest<HTMLElement>("[data-sentence-id]");
    if (!item) {
      onSelectText(null);
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();

    onSelectText({
      text,
      sentenceId: Number(item.dataset.sentenceId),
      rect: { top: rect.top, left: rect.left, width: rect.width },
    });
  }

  return (
    <ol
      ref={listRef}
      onMouseUp={readSelection}
      onTouchEnd={readSelection}
      className="flex flex-col gap-2 overflow-y-auto pr-1"
    >
      {sentences.map((sentence) => {
        const active = sentence.id === activeId;
        const looping = sentence.id === loopId;

        return (
          <li
            key={sentence.id}
            data-sentence-id={sentence.id}
            className={[
              "group rounded-lg border p-3 transition-colors",
              active
                ? "border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40"
                : "border-transparent hover:border-neutral-200 hover:bg-neutral-50 dark:hover:border-neutral-800 dark:hover:bg-neutral-900",
            ].join(" ")}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => onSelect(sentence)}
                title="Ir a esta frase"
                className="mt-0.5 shrink-0 select-none rounded px-1.5 py-0.5 font-mono text-xs text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                {formatTime(sentence.start)}
              </button>

              <div className="min-w-0 flex-1">
                {/* Texto normal y seleccionable: sombrear es lo que guarda palabras. */}
                <p className="text-lg leading-relaxed">
                  <HighlightedText text={sentence.en} pattern={highlight} />
                </p>

                {showEs && (
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {sentence.es}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onToggleLoop(sentence.id)}
                title={looping ? "Detener el bucle" : "Repetir esta frase en bucle"}
                aria-pressed={looping}
                className={[
                  "shrink-0 select-none rounded-md px-2 py-1 text-sm transition-colors",
                  looping
                    ? "bg-sky-600 text-white"
                    : "text-neutral-400 opacity-0 hover:bg-neutral-200 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-neutral-800",
                ].join(" ")}
              >
                🔁
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
