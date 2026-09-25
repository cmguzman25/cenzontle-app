"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import HighlightedText, {
  buildHighlightPattern,
} from "@/components/HighlightedText";
import SentenceExplanation, {
  hasExplanation,
} from "@/components/SentenceExplanation";
import { formatTime } from "@/lib/dates";
import type { Sentence } from "@/lib/types";

/** Cuánto respeta el autoscroll al usuario después de que mueva la lista. */
const PAUSE_MS = 5000;

/** Cuánto esperamos antes de leer lo sombreado. Ver el efecto que lo usa. */
const SELECTION_MS = 250;

export type TextSelection = {
  text: string;
  sentenceId: number;
  /**
   * De qué lección es la frase. En la transcripción sobra (todas son de la
   * misma), pero el buscador enseña frases de lecciones distintas mezcladas y
   * ahí hace falta para guardar la palabra en su sitio.
   */
  lessonId?: string;
  /** Posición en pantalla del texto sombreado. */
  rect: { top: number; left: number; width: number; height: number };
};

/**
 * Lee lo que hay sombreado en la transcripción. Devuelve `null` si no sirve
 * para guardar: nada sombreado, un párrafo entero, o texto de fuera de la lista.
 */
export function readTextSelection(): TextSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const text = selection.toString().trim().replace(/\s+/g, " ");
  // Ni vacío ni un párrafo entero.
  if (!text || text.length > 80) return null;

  const anchor = selection.anchorNode;
  const element =
    anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
  const item = element?.closest<HTMLElement>("[data-sentence-id]");
  if (!item) return null;

  const rect = selection.getRangeAt(0).getBoundingClientRect();

  return {
    text,
    sentenceId: Number(item.dataset.sentenceId),
    lessonId: item.dataset.lessonId,
    rect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
  };
}

type Props = {
  sentences: Sentence[];
  activeId: number | null;
  loopId: number | null;
  /** Frase donde lo dejó el usuario la última vez: lleva la marca 📍. */
  savedPositionId: number | null;
  showEs: boolean;
  autoScroll: boolean;
  savedWords: Set<string>;
  /** Frase cuyo tiempo se está cuadrando ahora mismo con las flechas. */
  tuningId: number | null;
  /** Frases cuyo tiempo ya cuadró alguien a mano. */
  tunedIds: Set<number>;
  onSelect: (sentence: Sentence) => void;
  /** Pulsar una palabra guardada: suena solo ese trozo del audio. */
  onPlayWord: (term: string, sentenceId: number, at?: number) => void;
  onToggleLoop: (id: number) => void;
  /** Abre (o cierra) el ajuste de tiempo de la frase entera. */
  onToggleTune: (id: number) => void;
  /** Pone o quita la marca 📍 de por dónde va el usuario. */
  onToggleSavedPosition: (id: number) => void;
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
  tuningId,
  tunedIds,
  onSelect,
  onPlayWord,
  onToggleLoop,
  onToggleTune,
  onToggleSavedPosition,
  onSaveWord,
  onSelectText,
}: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  /** Solo una explicación abierta a la vez: en el móvil la lista se dispara. */
  const [openId, setOpenId] = useState<number | null>(null);
  /** Mientras el usuario mueve la lista a mano, el autoscroll no le pelea. */
  const pausedUntil = useRef(0);

  // Una sola expresión regular para toda la lista, no una por frase.
  const highlight = useMemo(
    () => buildHighlightPattern(savedWords),
    [savedWords],
  );

  /**
   * Si el usuario toca la lista, el autoscroll se aparta unos segundos. Sin
   * esto, en el móvil cada frase nueva devolvía la lista a su sitio y era
   * imposible subir o bajar mientras el video sonaba.
   */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const pause = () => {
      pausedUntil.current = Date.now() + PAUSE_MS;
    };

    // `passive`: solo miramos, nunca cancelamos el gesto.
    const events = ["touchstart", "touchmove", "wheel"] as const;
    for (const name of events) {
      list.addEventListener(name, pause, { passive: true });
    }
    return () => {
      for (const name of events) list.removeEventListener(name, pause);
    };
  }, []);

  /**
   * Lleva la frase activa a la vista moviendo solo la lista, nunca la página:
   * `scrollIntoView` arrastraba también el scroll del documento y el video se
   * iba de sitio. Si la lista no tiene scroll propio no hay nada que hacer.
   */
  useEffect(() => {
    if (!autoScroll || activeId == null) return;
    if (Date.now() < pausedUntil.current) return;

    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(
      `[data-sentence-id="${activeId}"]`,
    );
    if (!list || !el) return;
    if (list.scrollHeight <= list.clientHeight + 1) return;

    const listBox = list.getBoundingClientRect();
    const elBox = el.getBoundingClientRect();
    // Centramos la frase dentro de la lista, sin tocar el scroll de la página.
    const delta =
      elBox.top - listBox.top - (list.clientHeight - elBox.height) / 2;
    list.scrollTo({ top: list.scrollTop + delta, behavior: "smooth" });
  }, [activeId, autoScroll]);

  /**
   * En el móvil no hay `mouseup`: se sombrea con un toque largo y luego se
   * mueven las asas, que son del navegador y no avisan a la página. `touchend`
   * llega antes de que exista la selección, así que con él el botón no salía
   * nunca. `selectionchange` sí avisa en el móvil y en el ordenador.
   *
   * Esperamos un momento antes de leer por dos motivos: no leer a media
   * selección mientras se arrastran las asas, y dar tiempo a que un toque en el
   * botón flotante se atienda antes de que el navegador borre lo sombreado.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onSelectText(readTextSelection()), SELECTION_MS);
    };

    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      clearTimeout(timer);
    };
  }, [onSelectText]);

  // `min-h-0` + `flex-1`: sin esto la lista crece hasta pasarse del alto del
  // panel y quien acaba haciendo scroll es la página, no la lista.
  return (
    <ol
      ref={listRef}
      // Con el ratón respondemos al soltar, sin esperar al `selectionchange`.
      onMouseUp={() => onSelectText(readTextSelection())}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pr-1"
    >
      {sentences.map((sentence) => {
        const active = sentence.id === activeId;
        const looping = sentence.id === loopId;
        const open = sentence.id === openId;
        const explainable = hasExplanation(sentence);
        const bookmarked = sentence.id === savedPositionId;
        const tuning = sentence.id === tuningId;
        const tuned = tunedIds.has(sentence.id);

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
              {/* A la izquierda, lo de situarse: el segundo y la marca. */}
              <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelect(sentence)}
                  title="Ir a esta frase"
                  className="select-none rounded px-1.5 py-0.5 font-mono text-xs text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  {formatTime(sentence.start)}
                </button>

                {/* Difuminada mientras no esté puesta: va en todas las frases y
                    a plena tinta serían cien chinchetas. Nunca invisible del
                    todo, que en el móvil no hay "pasar por encima". */}
                <button
                  type="button"
                  onClick={() => onToggleSavedPosition(sentence.id)}
                  title={
                    bookmarked
                      ? "Quitar la marca de por dónde vas"
                      : "Marcar aquí por dónde vas"
                  }
                  aria-pressed={bookmarked}
                  className={[
                    "select-none rounded-md px-1.5 py-0.5 text-sm transition-opacity",
                    bookmarked ? "opacity-100" : "opacity-25 hover:opacity-100",
                  ].join(" ")}
                >
                  📍
                </button>
              </div>

              <div className="min-w-0 flex-1">
                {/* Texto normal y seleccionable: sombrear es lo que guarda palabras. */}
                <p className="text-lg leading-relaxed">
                  <HighlightedText
                    text={sentence.en}
                    pattern={highlight}
                    onMarkClick={(term, at) =>
                      onPlayWord(term, sentence.id, at)
                    }
                  />
                </p>

                {showEs && (
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {sentence.es}
                  </p>
                )}
              </div>

              {/* En columna: el bucle arriba y, debajo, el ajuste de tiempo. */}
              <div className="flex shrink-0 flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleLoop(sentence.id)}
                  title={looping ? "Detener el bucle" : "Repetir esta frase en bucle"}
                  aria-pressed={looping}
                  className={[
                    "select-none rounded-md px-2 py-1 text-sm transition-colors",
                    looping
                      ? "bg-sky-600 text-white"
                      : "text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800",
                  ].join(" ")}
                >
                  🔁
                </button>

                <button
                  type="button"
                  onClick={() => onToggleTune(sentence.id)}
                  title={
                    tuning
                      ? "Cerrar el ajuste de tiempo"
                      : "Cuadrar esta frase con el audio"
                  }
                  aria-pressed={tuning}
                  className={[
                    "select-none rounded-md px-2 py-1 text-sm transition-colors",
                    tuning
                      ? "bg-amber-500 text-white"
                      : tuned
                        ? "text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-500/20"
                        : "text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800",
                  ].join(" ")}
                >
                  ↔
                </button>
              </div>
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

