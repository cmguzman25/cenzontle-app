"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ExplanationPanel from "@/components/ExplanationPanel";
import Quiz from "@/components/Quiz";
import SelectionPopover from "@/components/SelectionPopover";
import Transcript, { type TextSelection } from "@/components/Transcript";
import YouTubePlayer, { YT_STATE, type YTPlayer } from "@/components/YouTubePlayer";
import { removeWord, saveProgress, saveWord as saveWordToDb } from "@/lib/actions";
import type { ResolvedLesson, Sentence } from "@/lib/types";

export type SavedWord = {
  word: string;
  meaning: string;
  lessonId: string;
  sentenceId: number;
};

type Props = {
  lesson: ResolvedLesson;
  /** Si hay sesión, las palabras y el resultado se guardan en Supabase. */
  isLoggedIn: boolean;
  /** Palabras que el usuario ya tenía guardadas. */
  initialWords: SavedWord[];
};

export default function LessonView({ lesson, isLoggedIn, initialWords }: Props) {
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loopId, setLoopId] = useState<number | null>(null);
  const [repeats, setRepeats] = useState<Record<number, number>>({});
  const [pauseEach, setPauseEach] = useState(false);
  /** En modo pausa: id de la frase a la que saltaremos al continuar. */
  const [awaitingNext, setAwaitingNext] = useState<number | null>(null);
  const [showEs, setShowEs] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [words, setWords] = useState<SavedWord[]>(initialWords);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [saveError, setSaveError] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);

  // Refs para leer el estado más reciente dentro del callback de tiempo,
  // que se ejecuta cada 200 ms fuera del ciclo de render.
  const loopIdRef = useRef<number | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const pauseEachRef = useRef(false);
  const awaitingNextRef = useRef<number | null>(null);
  loopIdRef.current = loopId;
  pauseEachRef.current = pauseEach;

  const sentenceById = useMemo(
    () => new Map(lesson.sentences.map((s) => [s.id, s])),
    [lesson.sentences],
  );

  const savedWords = useMemo(
    () => new Set(words.map((w) => w.word.toLowerCase())),
    [words],
  );

  const activeSentence = activeId != null ? sentenceById.get(activeId) ?? null : null;

  const handleTime = useCallback(
    (seconds: number) => {
      setTime(seconds);

      // Si la lección es solo un trozo del video, paramos al llegar al final.
      if (lesson.endAt != null && seconds >= lesson.endAt) {
        playerRef.current?.pauseVideo();
        setShowQuiz(true);
        return;
      }

      // Bucle: al llegar al final de la frase, volvemos a su inicio.
      const looping = loopIdRef.current;
      if (looping != null) {
        const s = sentenceById.get(looping);
        if (s && seconds >= s.end - 0.05) {
          playerRef.current?.seekTo(s.start, true);
          setRepeats((r) => ({ ...r, [s.id]: (r[s.id] ?? 0) + 1 }));
          return;
        }
      }

      // Estamos parados esperando a que el usuario dé a "Continuar":
      // no tocamos nada para que siga viéndose la frase que acaba de escuchar.
      if (awaitingNextRef.current != null) return;

      const current = lesson.sentences.find(
        (s) => seconds >= s.start && seconds < s.end,
      );
      if (!current) return;

      if (current.id !== activeIdRef.current) {
        // Acabamos de entrar en una frase nueva.
        if (pauseEachRef.current && looping == null && activeIdRef.current != null) {
          // Modo "pausa entre frases": paramos al empezar la siguiente, pero
          // dejamos resaltada y explicada la que se acaba de oír.
          playerRef.current?.pauseVideo();
          playerRef.current?.seekTo(current.start, true);
          awaitingNextRef.current = current.id;
          setAwaitingNext(current.id);
          return;
        }
        activeIdRef.current = current.id;
        setActiveId(current.id);
      }
    },
    [lesson.endAt, lesson.sentences, sentenceById],
  );

  const goToSentence = useCallback((sentence: Sentence) => {
    awaitingNextRef.current = null;
    setAwaitingNext(null);
    activeIdRef.current = sentence.id;
    setActiveId(sentence.id);
    playerRef.current?.seekTo(sentence.start, true);
    playerRef.current?.playVideo();
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (playerRef.current.getPlayerState() === YT_STATE.PLAYING) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, []);

  const toggleLoop = useCallback(
    (id: number) => {
      awaitingNextRef.current = null;
      setAwaitingNext(null);
      setLoopId((current) => {
        if (current === id) return null;
        const s = sentenceById.get(id);
        if (s) {
          activeIdRef.current = id;
          setActiveId(id);
          playerRef.current?.seekTo(s.start, true);
          playerRef.current?.playVideo();
        }
        return id;
      });
    },
    [sentenceById],
  );

  const saveWord = useCallback(
    (word: string, meaning: string, sentence: Sentence) => {
      const key = word.toLowerCase();
      const alreadySaved = words.some((w) => w.word.toLowerCase() === key);

      // Actualización optimista: la UI responde al instante.
      setWords((current) =>
        alreadySaved
          ? current.filter((w) => w.word.toLowerCase() !== key)
          : [
              ...current,
              { word, meaning, lessonId: lesson.id, sentenceId: sentence.id },
            ],
      );

      if (!isLoggedIn) return;

      const request = alreadySaved
        ? removeWord(word)
        : saveWordToDb({
            word,
            meaning,
            lessonId: lesson.id,
            sentenceId: sentence.id,
            context: sentence.en,
          });

      request.then((result) => {
        if (!result.ok) {
          setSaveError(result.error);
          // Deshacemos el cambio optimista si el guardado falló.
          setWords((current) =>
            alreadySaved
              ? [
                  ...current,
                  { word, meaning, lessonId: lesson.id, sentenceId: sentence.id },
                ]
              : current.filter((w) => w.word.toLowerCase() !== key),
          );
        }
      });
    },
    [isLoggedIn, lesson.id, words],
  );

  /** Guarda (o quita) el texto que el usuario acaba de sombrear. */
  const applySelection = useCallback(() => {
    if (!selection) return;
    const sentence = sentenceById.get(selection.sentenceId);
    if (!sentence) return;

    const known = sentence.vocab?.find(
      (v) => v.word.toLowerCase() === selection.text.toLowerCase(),
    );

    saveWord(selection.text, known?.meaning ?? "", sentence);

    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [saveWord, selection, sentenceById]);

  // Si la página se mueve, la posición del botón flotante deja de valer.
  useEffect(() => {
    if (!selection) return;
    const clear = () => setSelection(null);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
    };
  }, [selection]);

  // Atajos de teclado.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const index = lesson.sentences.findIndex((s) => s.id === activeId);

      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "s" || event.key === "S") {
        setShowEs((v) => !v);
      } else if (event.key === "p" || event.key === "P") {
        setPauseEach((v) => !v);
      } else if (event.key === "l" || event.key === "L") {
        if (activeId != null) toggleLoop(activeId);
      } else if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        goToSentence(lesson.sentences[index - 1]);
      } else if (
        event.key === "ArrowRight" &&
        index >= 0 &&
        index < lesson.sentences.length - 1
      ) {
        event.preventDefault();
        goToSentence(lesson.sentences[index + 1]);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, goToSentence, lesson.sentences, togglePlay, toggleLoop]);

  const selectionSaved = selection
    ? savedWords.has(selection.text.toLowerCase())
    : false;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {selection && (
        <SelectionPopover
          selection={selection}
          saved={selectionSaved}
          onSave={applySelection}
          onRemove={applySelection}
        />
      )}

      <div className="flex flex-col gap-4">
        <YouTubePlayer
          videoId={lesson.youtubeId}
          start={lesson.startAt}
          onReady={(player) => {
            playerRef.current = player;
            setReady(true);
          }}
          onTime={handleTime}
          onStateChange={(state) => {
            setPlaying(state === YT_STATE.PLAYING);

            // Al volver a dar play (con nuestro botón o con el de YouTube),
            // avanzamos a la frase que estaba esperando.
            if (state === YT_STATE.PLAYING && awaitingNextRef.current != null) {
              const next = awaitingNextRef.current;
              awaitingNextRef.current = null;
              setAwaitingNext(null);
              activeIdRef.current = next;
              setActiveId(next);
            }

            if (state === YT_STATE.ENDED) setShowQuiz(true);
          }}
        />

        {/* Barra principal: el modo de escucha. */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPauseEach((v) => !v)}
            aria-pressed={pauseEach}
            title="Detiene el video al terminar cada frase"
            className={[
              "rounded-lg px-3 py-1.5 font-medium transition-colors",
              pauseEach
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800",
            ].join(" ")}
          >
            {pauseEach ? "⏸ Pausa entre frases: SÍ" : "▶ Seguido (sin pausas)"}
            <kbd className="ml-1 text-xs opacity-60">P</kbd>
          </button>

          {awaitingNext != null ? (
            <button
              type="button"
              onClick={() => playerRef.current?.playVideo()}
              className="rounded-lg bg-sky-600 px-4 py-1.5 font-medium text-white hover:bg-sky-700"
            >
              ▶ Siguiente frase
              <kbd className="ml-1 text-xs opacity-70">espacio</kbd>
            </button>
          ) : (
            pauseEach &&
            ready &&
            !playing && (
              <button
                type="button"
                onClick={togglePlay}
                className="rounded-lg bg-sky-600 px-4 py-1.5 font-medium text-white hover:bg-sky-700"
              >
                ▶ Continuar
                <kbd className="ml-1 text-xs opacity-70">espacio</kbd>
              </button>
            )
          )}

          {loopId != null && (
            <button
              type="button"
              onClick={() => setLoopId(null)}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700"
            >
              🔁 En bucle ({repeats[loopId] ?? 0}) — detener
              <kbd className="ml-1 text-xs opacity-70">L</kbd>
            </button>
          )}
        </div>

        {awaitingNext != null && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            ⏸ Pausado. Lee la explicación de la frase resaltada con calma y dale
            a <strong>Siguiente frase</strong> cuando quieras seguir.
          </p>
        )}

        {/* Barra secundaria: ayudas de lectura. */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setShowEs((v) => !v)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {showEs ? "Ocultar español" : "Mostrar español"}
            <kbd className="ml-1 text-xs text-neutral-400">S</kbd>
          </button>

          <button
            type="button"
            onClick={() => setAutoScroll((v) => !v)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Autoscroll: {autoScroll ? "sí" : "no"}
          </button>

          <button
            type="button"
            onClick={() => setShowQuiz((v) => !v)}
            className="ml-auto rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {showQuiz ? "Ocultar evaluación" : "Evaluar comprensión"}
          </button>
        </div>

        {saveError && (
          <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            No se pudo guardar en Supabase: {saveError}
          </p>
        )}

        {showQuiz && lesson.quiz.length > 0 && (
          <Quiz
            items={lesson.quiz}
            onFinish={({ percent, correct, total }) => {
              if (!isLoggedIn) return;
              saveProgress({ lessonId: lesson.id, score: percent, correct, total }).then(
                (result) => {
                  if (!result.ok) setSaveError(result.error);
                },
              );
            }}
          />
        )}

        <ExplanationPanel
          sentence={activeSentence}
          savedWords={savedWords}
          onSaveWord={saveWord}
        />

        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Palabras guardadas ({words.length})
          </h2>

          {words.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {words.map((w) => (
                <li
                  key={w.word.toLowerCase()}
                  title={w.meaning || "Sin significado guardado"}
                  className="rounded-full bg-amber-100 px-2.5 py-1 text-sm dark:bg-amber-500/20"
                >
                  {w.word}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Sombrea con el ratón una palabra o un trozo de frase en la
              transcripción y aparecerá el botón para guardarla.
            </p>
          )}

          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {isLoggedIn ? (
              <>
                Guardadas en tu cuenta.{" "}
                <Link href="/words" className="underline">
                  Ver todas
                </Link>
              </>
            ) : (
              <>
                Solo en esta pantalla.{" "}
                <Link href="/login" className="underline">
                  Entra
                </Link>{" "}
                para guardarlas en tu cuenta.
              </>
            )}
          </p>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Transcripción
          </h2>
          <span className="font-mono text-xs text-neutral-400">
            {ready ? formatClock(time) : "cargando…"}
          </span>
        </div>

        <Transcript
          sentences={lesson.sentences}
          activeId={activeId}
          loopId={loopId}
          showEs={showEs}
          autoScroll={autoScroll}
          savedWords={savedWords}
          onSelect={goToSentence}
          onToggleLoop={toggleLoop}
          onSelectText={setSelection}
        />
      </aside>
    </div>
  );
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
