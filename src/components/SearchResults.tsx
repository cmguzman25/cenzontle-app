"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import SelectionPopover from "@/components/SelectionPopover";
import { readTextSelection, type TextSelection } from "@/components/Transcript";
import YouTubePlayer, { YT_STATE, type YTPlayer } from "@/components/YouTubePlayer";
import { removeWord, saveWord as saveWordToDb } from "@/lib/actions";
import { formatTime } from "@/lib/dates";
import {
  formatLoopPause,
  LOOP_PAUSE_OPTIONS,
  readLoopPause,
  writeLoopPause,
} from "@/lib/loop-pause";
import type { SearchHit } from "@/lib/search";
import { findFolded } from "@/lib/text";

/** Aire al final de la frase: cortar en seco se come la última sílaba. */
const TAIL = 0.15;

/** Identifica una frase entre todos los resultados. */
function hitKey(hit: SearchHit): string {
  return `${hit.lessonId}:${hit.sentenceId}`;
}

type Props = {
  hits: SearchHit[];
  /** Lo que se buscó, para resaltarlo. */
  query: string;
  /** Palabras que el usuario ya tiene guardadas, tal como las guardó. */
  initialSaved: string[];
};

/**
 * Los resultados de la búsqueda, con lo mismo que se usa al estudiar: escuchar
 * la frase, repetirla en bucle y guardar trozos sombreándolos.
 *
 * Hay un solo reproductor para toda la lista, no uno por frase: son decenas de
 * resultados y montar un vídeo en cada uno dejaría la página inservible. Como
 * las partes de un mismo capítulo comparten vídeo, saltar entre ellas es solo
 * mover el reloj.
 */
export default function SearchResults({ hits, query, initialSaved }: Props) {
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** Frase sonando (o preparada para sonar), y cómo. */
  const [active, setActive] = useState<SearchHit | null>(null);
  const [looping, setLooping] = useState(false);
  const [loopPause, setLoopPause] = useState(readLoopPause);
  const [repeats, setRepeats] = useState(0);
  /**
   * El banco de palabras: en minúsculas para comparar, pero guardando cómo se
   * escribió. Para borrar en Supabase hace falta la palabra tal cual: si se
   * guardó "Will" y sombreas "will", borrar por lo sombreado no encuentra nada
   * y la pantalla diría que se quitó cuando sigue ahí.
   */
  const [saved, setSaved] = useState(
    () => new Map(initialSaved.map((word) => [word.toLowerCase(), word])),
  );
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [saveError, setSaveError] = useState("");

  /**
   * Tramo que estamos escuchando. `armed` existe porque el reloj de YouTube
   * tarda en enterarse del salto: hasta no ver un tiempo cercano al tramo no
   * activamos el freno, o pararíamos al instante con el segundo viejo.
   */
  const rangeRef = useRef<{ from: number; to: number; armed: boolean } | null>(
    null,
  );
  const loopingRef = useRef(false);
  /** Respiro del bucle en marcha: mientras esté puesto, el reloj no manda. */
  const loopPauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopPauseMsRef = useRef(loopPause);

  useEffect(() => {
    loopingRef.current = looping;
    loopPauseMsRef.current = loopPause;
  }, [looping, loopPause]);

  const cancelLoopPause = useCallback(() => {
    if (!loopPauseRef.current) return;
    clearTimeout(loopPauseRef.current);
    loopPauseRef.current = null;
  }, []);

  useEffect(() => cancelLoopPause, [cancelLoopPause]);

  const handleTime = useCallback((seconds: number) => {
    if (loopPauseRef.current) return;

    const range = rangeRef.current;
    if (!range) return;

    if (!range.armed) {
      // La ventana se pasa del final a propósito: con tramos cortos el primer
      // tic tras el salto puede caer ya pasado el final, y entonces el freno
      // no se armaba nunca y el vídeo seguía sonando.
      if (seconds >= range.from - 0.5 && seconds < range.to + 1.5) {
        rangeRef.current = { ...range, armed: true };
      }
      return;
    }

    if (seconds < range.to) return;

    playerRef.current?.pauseVideo();

    if (!loopingRef.current) {
      rangeRef.current = null;
      return;
    }

    setRepeats((n) => n + 1);
    loopPauseRef.current = setTimeout(() => {
      loopPauseRef.current = null;
      playerRef.current?.seekTo(range.from, true);
      playerRef.current?.playVideo();
    }, loopPauseMsRef.current);
  }, []);

  /** Suena la frase desde su principio. */
  const play = useCallback(
    (hit: SearchHit, loop: boolean) => {
      cancelLoopPause();

      // Con otro vídeo el reproductor se rehace entero. Hay que mirarlo antes
      // de cambiar de frase: tocar el que está a punto de morir suelta un
      // instante del vídeo anterior antes de irse.
      const sameVideo = active?.youtubeId === hit.youtubeId;

      setActive(hit);
      setLooping(loop);
      loopingRef.current = loop;
      setRepeats(0);

      const range = { from: hit.start, to: hit.end + TAIL, armed: false };
      rangeRef.current = range;

      // Si hay que rehacerlo, de arrancar se encarga su `onReady`.
      if (!sameVideo) return;
      playerRef.current?.seekTo(range.from, true);
      playerRef.current?.playVideo();
    },
    [active, cancelLoopPause],
  );

  const stop = useCallback(() => {
    cancelLoopPause();
    rangeRef.current = null;
    loopingRef.current = false;
    setLooping(false);
    playerRef.current?.pauseVideo();
  }, [cancelLoopPause]);

  /** Guarda (o quita) el trozo sombreado. */
  const applySelection = useCallback(() => {
    if (!selection) return;

    const text = selection.text;
    const key = text.toLowerCase();
    const stored = saved.get(key);
    const already = stored != null;
    const hit = hits.find(
      (h) =>
        h.sentenceId === selection.sentenceId &&
        h.lessonId === selection.lessonId,
    );

    // En pantalla, al momento; si Supabase se queja, se deshace.
    setSaved((current) => {
      const next = new Map(current);
      if (already) next.delete(key);
      else next.set(key, text);
      return next;
    });

    window.getSelection()?.removeAllRanges();
    setSelection(null);

    const request = already
      ? removeWord(stored)
      : saveWordToDb({
          word: text,
          meaning: "",
          lessonId: hit?.lessonId,
          sentenceId: hit?.sentenceId,
          context: hit?.en,
        });

    request.then((result) => {
      if (result.ok) return;
      setSaveError(result.error);
      setSaved((current) => {
        const next = new Map(current);
        if (already) next.set(key, stored);
        else next.delete(key);
        return next;
      });
    });
  }, [hits, saved, selection]);

  // Lo sombreado se lee al soltar el ratón y, en el móvil, cuando el navegador
  // avisa de que cambió la selección (allí no hay `mouseup`).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setSelection(readTextSelection()), 250);
    };

    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      clearTimeout(timer);
    };
  }, []);

  const activeKey = active ? hitKey(active) : null;

  return (
    <>
      {selection && (
        <SelectionPopover
          selection={selection}
          saved={saved.has(selection.text.toLowerCase())}
          onSave={applySelection}
          onRemove={applySelection}
        />
      )}

      {/* Barra fija abajo, como un reproductor de música. Fija y no dentro de
          la lista porque al aparecer no puede empujar los resultados: estarías
          leyendo una frase y se te iría de debajo del dedo.

          El vídeo va pequeño pero visible: es para escuchar, no para mirar, y
          YouTube no reproduce en un reproductor escondido. */}
      {active && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
          <div className="mx-auto flex max-w-3xl gap-3">
            <div className="w-40 shrink-0 sm:w-48">
              <YouTubePlayer
                videoId={active.youtubeId}
                start={active.start}
                onReady={(player) => {
                  playerRef.current = player;
                  setReady(true);
                  // Recién creado (primera frase, o cambio de vídeo): el play
                  // que pidió el usuario se quedó esperando a esto.
                  const range = rangeRef.current;
                  if (!range) return;
                  player.seekTo(range.from, true);
                  player.playVideo();
                }}
                onTime={handleTime}
                // El play de la pantalla del propio reproductor. Sin rearmar
                // el freno, al acabar la frase el vídeo seguiría sonando solo.
                onRequestPlay={() => play(active, looping)}
                onStateChange={(state) => setPlaying(state === YT_STATE.PLAYING)}
              />
            </div>

            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {active.chapterTitle ?? active.lessonTitle}
                {active.part != null && ` · Parte ${active.part}`} ·{" "}
                {formatTime(active.start)}
              </p>
              <p className="mt-0.5 line-clamp-2">{active.en}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => (playing ? stop() : play(active, looping))}
                  disabled={!ready}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {playing ? "⏸ Parar" : "▶ Escuchar"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !looping;
                    setLooping(next);
                    loopingRef.current = next;
                    if (next) play(active, true);
                    else cancelLoopPause();
                  }}
                  aria-pressed={looping}
                  className={[
                    "rounded-lg px-3 py-1.5 transition-colors",
                    looping
                      ? "bg-sky-600 text-white hover:bg-sky-700"
                      : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800",
                  ].join(" ")}
                >
                  🔁 Bucle{looping && repeats > 0 ? ` (${repeats})` : ""}
                </button>

                {looping && (
                  <label
                    title="Silencio entre una vuelta y la siguiente"
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs dark:border-neutral-700"
                  >
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Pausa
                    </span>
                    <select
                      value={loopPause}
                      onChange={(event) => {
                        const ms = Number(event.target.value);
                        setLoopPause(ms);
                        writeLoopPause(ms);
                      }}
                      className="bg-transparent font-medium outline-none [&>option]:bg-white dark:[&>option]:bg-neutral-900"
                    >
                      {LOOP_PAUSE_OPTIONS.map((ms) => (
                        <option key={ms} value={ms}>
                          {formatLoopPause(ms)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => {
                    stop();
                    setActive(null);
                  }}
                  className="ml-auto rounded-lg px-2 py-1.5 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  title="Cerrar el reproductor"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {saveError && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          No se pudo guardar en Supabase: {saveError}
        </p>
      )}

      <ol className="mt-3 flex flex-col gap-2">
        {hits.map((hit) => {
          const key = hitKey(hit);
          const isActive = key === activeKey;

          return (
            <li
              key={key}
              // Sombrear texto aquí dentro lo guarda en el banco, y de aquí
              // saca `readTextSelection` a qué frase pertenece.
              data-sentence-id={hit.sentenceId}
              data-lesson-id={hit.lessonId}
              className={[
                "rounded-xl border p-3 transition-colors",
                isActive
                  ? "border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40"
                  : "border-neutral-200 dark:border-neutral-800",
              ].join(" ")}
            >
              <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-medium">
                  {hit.chapterTitle ?? hit.lessonTitle}
                </span>
                {hit.part != null && (
                  <span>
                    Parte {hit.part}
                    {hit.total ? ` de ${hit.total}` : ""}
                  </span>
                )}
                <span className="font-mono">{formatTime(hit.start)}</span>
              </p>

              {/* Texto normal y seleccionable: sombrearlo es lo que guarda. */}
              <p className="mt-1 text-lg leading-relaxed">
                <Marked text={hit.en} query={hit.inSpanish ? "" : query} />
              </p>

              {hit.es && (
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  <Marked text={hit.es} query={hit.inSpanish ? query : ""} />
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {/* Lo mismo que abajo, pero aquí: con veinte resultados, la
                    barra queda lejos de la frase que estás mirando. */}
                <button
                  type="button"
                  onClick={() =>
                    isActive && playing ? stop() : play(hit, false)
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {isActive && playing ? "⏸ Parar" : "▶ Escuchar"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    isActive && looping ? stop() : play(hit, true)
                  }
                  aria-pressed={isActive && looping}
                  className={[
                    "rounded-lg px-3 py-1.5 transition-colors",
                    isActive && looping
                      ? "bg-sky-600 text-white hover:bg-sky-700"
                      : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800",
                  ].join(" ")}
                >
                  🔁 Bucle
                </button>

                <Link
                  href={`/lesson/${hit.lessonId}?frase=${hit.sentenceId}`}
                  className="ml-auto text-neutral-500 hover:underline dark:text-neutral-400"
                >
                  Abrir la lección →
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Hueco para que la barra de abajo no tape el último resultado. */}
      <p
        className={[
          "mt-4 text-xs text-neutral-500 dark:text-neutral-400",
          active ? "pb-32" : "",
        ].join(" ")}
      >
        Sombrea una palabra o un trozo de frase para guardarlo en tu banco. En
        el móvil, mantén el dedo pulsado encima.
      </p>
    </>
  );
}

/** Pinta el texto marcando dónde cayó la búsqueda. */
function Marked({ text, query }: { text: string; query: string }) {
  const match = query ? findFolded(text, query) : null;
  if (!match) return <>{text}</>;

  const end = match.at + match.length;

  return (
    <>
      {text.slice(0, match.at)}
      <mark className="rounded bg-amber-100 text-inherit dark:bg-amber-500/25 dark:text-amber-100">
        {text.slice(match.at, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}
