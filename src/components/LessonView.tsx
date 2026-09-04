"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Quiz from "@/components/Quiz";
import SelectionPopover from "@/components/SelectionPopover";
import Transcript, {
  readTextSelection,
  type TextSelection,
} from "@/components/Transcript";
import WordTuner from "@/components/WordTuner";
import YouTubePlayer, { YT_STATE, type YTPlayer } from "@/components/YouTubePlayer";
import {
  removeWord,
  saveLessonPosition,
  saveProgress,
  saveSharedWordTiming,
  saveWord as saveWordToDb,
} from "@/lib/actions";
import type { ResolvedLesson, Sentence } from "@/lib/types";
import {
  clampRange,
  estimateWordRange,
  overlapsSentence,
  type Range,
} from "@/lib/word-timing";

export type SavedWord = {
  word: string;
  meaning: string;
  lessonId: string;
  sentenceId: number;
};

/**
 * Trozo de audio de una palabra ya cuadrado a mano por alguien. Es de la
 * lección, no de quien lo ajustó: el audio es el mismo para todos.
 *
 * Va por frase a propósito: la misma palabra sale en varias y cada aparición
 * suena en un segundo distinto.
 */
export type SharedTiming = {
  sentenceId: number;
  /** En minúsculas, como se guarda. */
  term: string;
  from: number;
  to: number;
  /** Alguien le dio el visto bueno: suena bien tal cual. */
  confirmed: boolean;
  /** Quién lo dejó ajustado, para saber si el trabajo venía de fuera. */
  updatedBy: string | null;
};

/** Lo que sabemos del trozo de una palabra: dónde suena y si está aprobado. */
type Timing = Range & { confirmed: boolean; updatedBy: string | null };

/** Clave de un ajuste dentro de la lección: frase + palabra en minúsculas. */
function timingKey(sentenceId: number, term: string): string {
  return `${sentenceId}|${term.trim().toLowerCase()}`;
}

type Props = {
  lesson: ResolvedLesson;
  /** Si hay sesión, las palabras y el resultado se guardan en Supabase. */
  isLoggedIn: boolean;
  /** Para distinguir los ajustes propios de los que dejó hechos otra persona. */
  userId: string | null;
  /** Palabras que el usuario ya tenía guardadas. */
  initialWords: SavedWord[];
  /** Ajustes de audio que ya hizo cualquier usuario en esta lección. */
  initialTimings: SharedTiming[];
  /** Frase por la que iba la última vez, si la tenemos guardada. */
  initialSentenceId: number | null;
};

export default function LessonView({
  lesson,
  isLoggedIn,
  userId,
  initialWords,
  initialTimings,
  initialSentenceId,
}: Props) {
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
  /** Ajustes de audio de la lección, de quien sea. Clave: `timingKey`. */
  const [timings, setTimings] = useState<Record<string, Timing>>(() =>
    Object.fromEntries(
      initialTimings.map((t) => [
        timingKey(t.sentenceId, t.term),
        {
          from: t.from,
          to: t.to,
          confirmed: t.confirmed,
          updatedBy: t.updatedBy,
        },
      ]),
    ),
  );
  const [selection, setSelection] = useState<TextSelection | null>(null);
  /** Palabra cuyo trozo de audio se está ajustando con las flechas. */
  const [tuning, setTuning] = useState<{
    word: string;
    sentenceId: number;
    range: Range;
    /** `true` cuando los segundos están guardados y no son la estimación. */
    tuned: boolean;
    /** El ajuste lo dejó hecho otra persona. */
    fromOthers: boolean;
    /** Visto bueno dado a mano con el botón. */
    confirmed: boolean;
  } | null>(null);
  const [saveError, setSaveError] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  /** Llegamos al final del tramo: el play ahora significa "repetir". */
  const [finished, setFinished] = useState(false);
  /** Frase marcada con 📍 en la lista: la última que guardamos en Supabase. */
  const [savedPositionId, setSavedPositionId] = useState(initialSentenceId);

  // Refs para leer el estado más reciente dentro del callback de tiempo,
  // que se ejecuta cada 200 ms fuera del ciclo de render.
  const loopIdRef = useRef<number | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const pauseEachRef = useRef(false);
  const awaitingNextRef = useRef<number | null>(null);
  /**
   * Segundo al que queremos volver al retomar la lección. Mientras esté puesto,
   * ignoramos el reloj del reproductor: con el video sin empezar devuelve 0 y
   * nos mandaría a la primera frase.
   */
  const resumeTargetRef = useRef<number | null>(null);
  /**
   * Trozo suelto que estamos escuchando (al pulsar una palabra guardada).
   * `null` = reproducción normal, sin freno.
   *
   * `armed` existe porque el reloj de YouTube tarda un poco en enterarse del
   * salto: hasta que no vemos un tiempo cerca del trozo no activamos el
   * freno, o pararíamos al instante con el segundo viejo.
   */
  const stopRangeRef = useRef<{
    from: number;
    to: number;
    armed: boolean;
  } | null>(null);
  /**
   * Al parar en seco la frase quedamos justo en su borde y el reloj, que sigue
   * corriendo con el video pausado, resaltaría ya la frase siguiente. Con esto
   * dejamos quieta la que se acaba de oír hasta que el usuario vuelva a jugar.
   */
  const holdActiveRef = useRef(false);
  /** Guardados del ajuste pendientes, uno por palabra. */
  const timingSaveTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
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

  // El panel enseña solo lo de esta parte; el resaltado en la transcripción
  // sigue usando todas, que una palabra de otro capítulo también vale aquí.
  const lessonWords = useMemo(
    () => words.filter((w) => w.lessonId === lesson.id),
    [words, lesson.id],
  );

  /**
   * Segundo en el que se acaba esta parte. Usamos el final de la última frase,
   * no `endAt`: entre una cosa y otra puede quedar audio sin transcribir, y
   * ahí el estudiante se queda oyendo algo que no tiene delante.
   * Si la lección es el video entero (`endAt` vacío), no hay límite.
   */
  const limit = useMemo(() => {
    if (lesson.endAt == null) return null;
    const last = lesson.sentences[lesson.sentences.length - 1];
    return last ? Math.min(lesson.endAt, last.end) : lesson.endAt;
  }, [lesson.endAt, lesson.sentences]);

  const handleTime = useCallback(
    (seconds: number) => {
      setTime(seconds);

      // Fin del tramo: paramos y ofrecemos la evaluación. Con la última frase
      // en bucle manda el bucle: repetirla no es haber terminado, y este corte
      // iba antes que el bucle, así que la frase sonaba una vez y se paraba.
      if (limit != null && seconds >= limit && loopIdRef.current == null) {
        playerRef.current?.pauseVideo();
        setFinished(true);
        setShowQuiz(true);
        return;
      }

      // Escuchando un trozo suelto: paramos al acabarlo.
      const range = stopRangeRef.current;
      if (range && !range.armed) {
        // La ventana pasa del final del trozo a propósito: con trozos de menos
        // de un segundo, el primer tic tras el salto puede caer ya pasado el
        // final, y con `seconds < range.to` el freno no se armaba nunca y el
        // video seguía sonando. Como mucho nos pasamos un tic (200 ms).
        if (seconds >= range.from - 0.5 && seconds < range.to + 1.5) {
          stopRangeRef.current = { ...range, armed: true };
        }
      } else if (range && seconds >= range.to) {
        playerRef.current?.pauseVideo();
        stopRangeRef.current = null;
        holdActiveRef.current = true;
        return;
      }
      if (holdActiveRef.current) return;

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

      // Retomando: mantenemos la frase guardada hasta que el video arranque.
      if (resumeTargetRef.current != null) return;

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
    [limit, lesson.sentences, sentenceById],
  );

  const goToSentence = useCallback((sentence: Sentence) => {
    awaitingNextRef.current = null;
    setAwaitingNext(null);
    resumeTargetRef.current = null;
    stopRangeRef.current = null;
    setFinished(false);
    activeIdRef.current = sentence.id;
    setActiveId(sentence.id);
    playerRef.current?.seekTo(sentence.start, true);
    playerRef.current?.playVideo();
  }, []);

  /**
   * Apunta el trozo ajustado: al momento en pantalla y, un poco después, en
   * Supabase. Se espera porque las flechas se tocan varias veces seguidas y no
   * hace falta una escritura por toque.
   *
   * Se guarda solo en el ajuste de la lección, que va por frase. Guardarlo
   * también en la palabra del usuario (una fila por palabra, sin frase) hacía
   * que la segunda aparición de una expresión sonara donde la primera.
   */
  const queueTimingSave = useCallback(
    (
      word: string,
      sentenceId: number,
      timing: Timing | null,
      /** El visto bueno se guarda ya; las flechas pueden esperar. */
      now = false,
    ) => {
      const shared = timingKey(sentenceId, word);

      setTimings((current) => {
        if (timing) return { ...current, [shared]: timing };
        const rest = { ...current };
        delete rest[shared];
        return rest;
      });

      if (!isLoggedIn) return;

      const timers = timingSaveTimers.current;
      const pending = timers.get(shared);
      if (pending) clearTimeout(pending);

      const write = () => {
        timers.delete(shared);

        saveSharedWordTiming({
          lessonId: lesson.id,
          sentenceId,
          term: word,
          from: timing?.from ?? null,
          to: timing?.to ?? null,
          confirmed: timing?.confirmed ?? false,
        }).then((result) => {
          if (!result.ok) setSaveError(result.error);
        });
      };

      if (now) {
        write();
        return;
      }
      timers.set(shared, setTimeout(write, 700));
    },
    [isLoggedIn, lesson.id],
  );

  // Si el usuario se va de la lección con un guardado en cola, lo cancelamos.
  useEffect(() => {
    const timers = timingSaveTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  /** Reproduce un tramo de segundos y para al final. No toca nada más. */
  const playRange = useCallback((sentence: Sentence, range: Range) => {
    awaitingNextRef.current = null;
    setAwaitingNext(null);
    resumeTargetRef.current = null;
    setLoopId(null);
    loopIdRef.current = null;
    setFinished(false);
    holdActiveRef.current = false;
    activeIdRef.current = sentence.id;
    setActiveId(sentence.id);
    stopRangeRef.current = { from: range.from, to: range.to, armed: false };
    playerRef.current?.seekTo(range.from, true);
    playerRef.current?.playVideo();
  }, []);

  /**
   * Escucha solo el trozo donde suena una palabra guardada y abre el ajuste.
   *
   * El ajuste es de esta frase, no de la palabra: la misma expresión sale en
   * varias frases y en cada una suena en otro segundo. Si no hay ajuste para
   * esta frase (o el guardado cae fuera de ella, de cuando se guardaban por
   * palabra), vamos a la estimación, que la transcripción no trae tiempos por
   * palabra. Si ni siquiera podemos situarla, suena la frase entera.
   */
  const playWord = useCallback(
    (term: string, sentenceId: number, at?: number) => {
      const sentence = sentenceById.get(sentenceId);
      if (!sentence) return;

      // El texto pulsado puede venir con otras mayúsculas que el guardado.
      const saved = words.find(
        (w) => w.word.toLowerCase() === term.toLowerCase(),
      );

      const stored = timings[timingKey(sentenceId, term)] ?? null;
      // Un ajuste que no suena dentro de su frase es de otra: no vale.
      const tuned = stored && overlapsSentence(sentence, stored) ? stored : null;

      const range =
        tuned ??
        estimateWordRange(sentence, term, at) ?? {
          from: sentence.start,
          to: sentence.end,
        };

      setTuning({
        word: saved?.word ?? term,
        sentenceId: sentence.id,
        range,
        tuned: tuned != null,
        // Nos interesa avisar de que el trabajo ya venía hecho de fuera.
        fromOthers: tuned != null && tuned.updatedBy !== userId,
        confirmed: tuned?.confirmed ?? false,
      });
      playRange(sentence, range);
    },
    [playRange, sentenceById, timings, userId, words],
  );

  /**
   * Mueve una flecha del ajuste: recorta, deja oír el resultado al momento y
   * guarda en segundo plano (con espera, que se toca varias veces seguidas).
   */
  const tuneWord = useCallback(
    (range: Range) => {
      if (!tuning) return;
      const sentence = sentenceById.get(tuning.sentenceId);
      if (!sentence) return;

      const next = clampRange(sentence, range);
      setTuning({ ...tuning, range: next, tuned: true, fromOthers: false });
      playRange(sentence, next);
      // Mover las flechas no toca el visto bueno: eso lo decide el botón.
      queueTimingSave(tuning.word, tuning.sentenceId, {
        ...next,
        confirmed: tuning.confirmed,
        updatedBy: userId,
      });
    },
    [playRange, queueTimingSave, sentenceById, tuning, userId],
  );

  /**
   * Tira el ajuste y vuelve a la estimación automática. Como el ajuste es de
   * la lección, esto también lo deshace para los demás.
   */
  const resetWordTiming = useCallback(() => {
    if (!tuning) return;
    const sentence = sentenceById.get(tuning.sentenceId);
    if (!sentence) return;

    const range = estimateWordRange(sentence, tuning.word) ?? {
      from: sentence.start,
      to: sentence.end,
    };
    setTuning({
      ...tuning,
      range,
      tuned: false,
      fromOthers: false,
      confirmed: false,
    });
    playRange(sentence, range);
    queueTimingSave(tuning.word, tuning.sentenceId, null);
  }, [playRange, queueTimingSave, sentenceById, tuning]);

  /**
   * El visto bueno: lo pone y lo quita el usuario con el botón, nunca solo.
   * Guarda al momento, que es una decisión, no un tanteo.
   */
  const toggleWordConfirmed = useCallback(() => {
    if (!tuning) return;
    const confirmed = !tuning.confirmed;
    setTuning({ ...tuning, tuned: true, confirmed });
    queueTimingSave(
      tuning.word,
      tuning.sentenceId,
      { ...tuning.range, confirmed, updatedBy: userId },
      true,
    );
  }, [queueTimingSave, tuning, userId]);

  /** Vuelve al principio del tramo. Es lo que hace el play una vez terminado. */
  const restart = useCallback(() => {
    const first = lesson.sentences[0];
    awaitingNextRef.current = null;
    setAwaitingNext(null);
    resumeTargetRef.current = null;
    stopRangeRef.current = null;
    setFinished(false);
    if (first) {
      activeIdRef.current = first.id;
      setActiveId(first.id);
      playerRef.current?.seekTo(first.start, true);
    }
    playerRef.current?.playVideo();
  }, [lesson.sentences]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    // Dar al play es "sigue sonando": si quedaba el freno de un trozo suelto,
    // lo soltamos o pararía de nuevo al llegar a su final.
    stopRangeRef.current = null;
    holdActiveRef.current = false;
    if (playerRef.current.getPlayerState() === YT_STATE.PLAYING) {
      playerRef.current.pauseVideo();
    } else if (finished) {
      // Sin esto el video arrancaría pasado el límite, en la parte que ya no
      // tiene transcripción.
      restart();
    } else {
      playerRef.current.playVideo();
    }
  }, [finished, restart]);

  const toggleLoop = useCallback(
    (id: number) => {
      awaitingNextRef.current = null;
      setAwaitingNext(null);
      resumeTargetRef.current = null;
      stopRangeRef.current = null;
      setFinished(false);
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

      // Si quitamos la palabra que se estaba ajustando, el panel sobra.
      if (alreadySaved) {
        setTuning((current) =>
          current && current.word.toLowerCase() === key ? null : current,
        );
      }

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

  // Recordamos por dónde vamos. Esperamos 2 s para no guardar las frases por
  // las que solo pasamos de largo, y para no llamar a Supabase cada 3 segundos.
  useEffect(() => {
    if (!isLoggedIn || activeId == null || activeId === savedPositionId) return;

    const timer = setTimeout(() => {
      setSavedPositionId(activeId);
      saveLessonPosition({ lessonId: lesson.id, sentenceId: activeId }).then(
        (result) => {
          if (!result.ok) setSaveError(result.error);
        },
      );
    }, 2000);

    return () => clearTimeout(timer);
  }, [activeId, isLoggedIn, lesson.id, savedPositionId]);

  const hasSelection = selection != null;

  // Si algo se mueve, el botón flotante sigue al texto sombreado en vez de
  // desaparecer: en el móvil la lista se mueve sola al sombrear y el botón se
  // perdía antes de que diera tiempo a tocarlo.
  useEffect(() => {
    if (!hasSelection) return;
    const sync = () => setSelection(readTextSelection());
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [hasSelection]);

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
      {tuning && (
        <WordTuner
          word={tuning.word}
          range={tuning.range}
          tuned={tuning.tuned}
          fromOthers={tuning.fromOthers}
          confirmed={tuning.confirmed}
          onChange={tuneWord}
          onToggleConfirmed={toggleWordConfirmed}
          onReset={resetWordTiming}
          onPlay={() => {
            const sentence = sentenceById.get(tuning.sentenceId);
            if (sentence) playRange(sentence, tuning.range);
          }}
          onClose={() => setTuning(null)}
        />
      )}

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

            // Volvemos a donde lo dejamos, sin arrancar el video solo.
            const resume =
              initialSentenceId != null
                ? sentenceById.get(initialSentenceId)
                : null;
            if (resume) {
              activeIdRef.current = resume.id;
              setActiveId(resume.id);
              resumeTargetRef.current = resume.start;
              player.seekTo(resume.start, true);
            }
          }}
          onTime={handleTime}
          onRequestPlay={togglePlay}
          onStateChange={(state) => {
            setPlaying(state === YT_STATE.PLAYING);

            // Vuelve a sonar: el resaltado deja de estar congelado.
            if (state === YT_STATE.PLAYING) holdActiveRef.current = false;

            // Ya arrancó: soltamos el freno. Si YouTube ignoró nuestro salto
            // (a veces pasa con el video sin empezar), lo repetimos.
            if (state === YT_STATE.PLAYING && resumeTargetRef.current != null) {
              const target = resumeTargetRef.current;
              resumeTargetRef.current = null;
              const now = playerRef.current?.getCurrentTime() ?? target;
              if (Math.abs(now - target) > 1.5) {
                playerRef.current?.seekTo(target, true);
              }
            }

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

          {/* El reproductor de YouTube va sin controles, así que play y pausa
              tienen que estar siempre a mano aquí. */}
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
            <button
              type="button"
              onClick={togglePlay}
              disabled={!ready}
              className="rounded-lg bg-sky-600 px-4 py-1.5 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {playing ? "⏸ Pausar" : "▶ Reproducir"}
              <kbd className="ml-1 text-xs opacity-70">espacio</kbd>
            </button>
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

        {finished && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <span>
              ✅ Fin de esta parte. El resto del video no tiene transcripción
              todavía.
            </span>
            <button
              type="button"
              onClick={restart}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
            >
              🔁 Repetir desde el principio
            </button>
          </div>
        )}

        {awaitingNext != null && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            ⏸ Pausado. Abre <strong>💡 Ver explicación</strong> en la frase
            resaltada y dale a <strong>Siguiente frase</strong> cuando quieras
            seguir.
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

        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Palabras de esta parte ({lessonWords.length})
          </h2>

          {lessonWords.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {lessonWords.map((w) => {
                // Sin la frase (palabras viejas) el chip no lleva a ningún sitio.
                const playable = sentenceById.has(w.sentenceId);
                // El ✓ solo sale si alguien le dio el visto bueno a mano.
                const confirmed =
                  timings[timingKey(w.sentenceId, w.word)]?.confirmed ?? false;
                return (
                  <li key={w.word.toLowerCase()}>
                    <button
                      type="button"
                      disabled={!playable}
                      onClick={() => playWord(w.word, w.sentenceId)}
                      title={[
                        playable ? "Escucharla" : null,
                        confirmed ? "audio comprobado" : null,
                        w.meaning || "sin significado guardado",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      className={[
                        "rounded-full px-2.5 py-1 text-sm transition-colors disabled:cursor-default",
                        tuning?.word.toLowerCase() === w.word.toLowerCase()
                          ? "bg-amber-300 dark:bg-amber-500/50"
                          : "bg-amber-100 enabled:hover:bg-amber-200 dark:bg-amber-500/20 dark:enabled:hover:bg-amber-500/30",
                      ].join(" ")}
                    >
                      {playable && <span className="mr-1 text-xs">▶</span>}
                      {w.word}
                      {confirmed && (
                        <span
                          aria-label="audio comprobado"
                          className="ml-1 text-xs text-emerald-700 dark:text-emerald-400"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Sombrea una palabra o un trozo de frase en la transcripción y
              aparecerá el botón para guardarla. En el móvil, mantén el dedo
              pulsado sobre la palabra.
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

      {/* El alto máximo es lo que hace que la transcripción tenga su propio
          scroll también en el móvil: así el video no se mueve de sitio. */}
      <aside className="flex max-h-[70svh] min-h-0 flex-col gap-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Transcripción
          </h2>
          <span className="font-mono text-xs text-neutral-400">
            {ready ? formatClock(time) : "cargando…"}
          </span>
        </div>

        {initialSentenceId != null && activeId === initialSentenceId && (
          <p className="rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            📍 Seguimos donde lo dejaste.
          </p>
        )}

        <Transcript
          sentences={lesson.sentences}
          activeId={activeId}
          loopId={loopId}
          savedPositionId={savedPositionId}
          showEs={showEs}
          autoScroll={autoScroll}
          savedWords={savedWords}
          onSelect={goToSentence}
          onPlayWord={playWord}
          onToggleLoop={toggleLoop}
          onSaveWord={saveWord}
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
