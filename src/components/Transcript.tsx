"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import HighlightedText, {
  buildHighlightPattern,
} from "@/components/HighlightedText";
import SentenceExplanation, {
  hasExplanation,
} from "@/components/SentenceExplanation";
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
  /** Frase donde lo dejó el usuario la última vez: lleva la marca 📍. */
  savedPositionId: number | null;
  showEs: boolean;
  autoScroll: boolean;
  savedWords: Set<string>;
  onSelect: (sentence: Sentence) => void;
  onToggleLoop: (id: number) => void;
  onSaveWord: (word: string, meaning: string, sentence: Sentence) => void;
  /** Se llama al soltar el ratón habiendo sombreado texto. */
  onSelectText: (selection: TextSelection | null) => void;
};

export default function Transcript({
  sentences,
  activeId,
  loopId,
  savedPositionId,
  showEs,
  autoScroll,
  savedWords,
  onSelect,
  onToggleLoop,
  onSaveWord,
  onSelectText,
}: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  /** Solo una explicación abierta a la vez: en el móvil la lista se dispara. */
  const [openId, setOpenId] = useState<number | null>(null);

  // Una sola expresión regular para toda la lista, no una por frase.
  const highlight = useMemo(
    () => buildHighlightPattern(savedWords),
    [savedWords],
  );

  /**
   * Lleva la frase activa a la vista.
   *
   * No usamos `scrollIntoView`: ese método mueve todos los contenedores con
   * scroll que haya por encima, incluida la página, y el video se acaba yendo
   * de sitio. Cuando la lista tiene su propio scroll (escritorio) movemos solo
   * la lista; si no lo tiene (móvil), movemos la página lo mínimo y solo si la
   * frase no se ve.
   */
  useEffect(() => {
    if (!autoScroll || activeId == null) return;

    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(
      `[data-sentence-id="${activeId}"]`,
    );
    if (!list || !el) return;

    if (list.scrollHeight > list.clientHeight + 1) {
      const listBox = list.getBoundingClientRect();
      const elBox = el.getBoundingClientRect();
      // Centramos la frase dentro de la lista, sin tocar el scroll de la página.
      const delta =
        elBox.top - listBox.top - (list.clientHeight - elBox.height) / 2;
      list.scrollTo({ top: list.scrollTop + delta, behavior: "smooth" });
      return;
    }

    const box = el.getBoundingClientRect();
    const visible = box.top >= 0 && box.bottom <= window.innerHeight;
    if (!visible) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

  // `min-h-0` + `flex-1`: sin esto la lista crece hasta pasarse del alto del
  // panel y quien acaba haciendo scroll es la página, no la lista.
  return (
    <ol
      ref={listRef}
      onMouseUp={readSelection}
      onTouchEnd={readSelection}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pr-1"
    >
      {sentences.map((sentence) => {
        const active = sentence.id === activeId;
        const looping = sentence.id === loopId;
        const open = sentence.id === openId;
        const explainable = hasExplanation(sentence);
        const bookmarked = sentence.id === savedPositionId;

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
                  {bookmarked && (
                    <span
                      title="Aquí lo dejaste la última vez"
                      className="mr-1 select-none"
                    >
                      📍
                    </span>
                  )}
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
                    : "text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800",
                ].join(" ")}
              >
                🔁
              </button>
            </div>

            {explainable && (
              <button
                type="button"
                onClick={() => setOpenId(open ? null : sentence.id)}
                aria-expanded={open}
                className={[
                  "mt-1 select-none rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  open
                    ? "bg-neutral-200 dark:bg-neutral-800"
                    : "text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800",
                ].join(" ")}
              >
                {open ? "▲ Ocultar explicación" : "💡 Ver explicación"}
              </button>
            )}

            {open && (
              <SentenceExplanation
                sentence={sentence}
                showEs={showEs}
                savedWords={savedWords}
                onSaveWord={onSaveWord}
              />
            )}
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
