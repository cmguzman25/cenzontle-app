"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { fieldClass } from "@/components/AuthForm";
import { COMPONENT, loadYouglish, type YGWidget } from "@/lib/youglish";

/**
 * Qué partes pinta YouGlish. Dejamos fuera su buscador y sus botones: abajo
 * ponemos los nuestros, que además traen "Más contexto".
 */
const COMPONENTS = COMPONENT.ACCENT + COMPONENT.TITLE + COMPONENT.CAPTION;

/** Cuánto rebobina "Más contexto". */
const REWIND = 3;

const SPEEDS = [0.75, 1] as const;

type Status = "idle" | "loading" | "ready" | "empty";

export default function PhraseSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<YGWidget | null>(null);
  /** Para no repetir la búsqueda que viene en la URL. */
  const launched = useRef(false);
  const domId = `yg-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  const [text, setText] = useState(initialQuery);
  const [status, setStatus] = useState<Status>("idle");
  const [total, setTotal] = useState(0);
  const [track, setTrack] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);
  /** Por qué no hay widget, si es que no lo hay. */
  const [failed, setFailed] = useState("");
  /** Se cambia para volver a intentar la carga. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loadYouglish()
      .then((YG) => {
        if (cancelled || !containerRef.current) return;

        widgetRef.current = new YG.Widget(domId, {
          // A lo ancho del hueco que tenga: en móvil, si no, se sale.
          width: containerRef.current.clientWidth,
          components: COMPONENTS,
          autoStart: 1,
          events: {
            onFetchDone: (event) => {
              setTotal(event.totalResult);
              setStatus(event.totalResult > 0 ? "ready" : "empty");
            },
            onVideoChange: (event) => setTrack(event.trackNumber),
            onError: () => setFailed("El reproductor de YouGlish falló."),
          },
        });

        setReady(true);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setFailed(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [domId, attempt]);

  const runSearch = useCallback((query: string) => {
    const widget = widgetRef.current;
    const clean = query.trim();
    if (!widget || !clean) return;

    setStatus("loading");
    setTotal(0);
    setTrack(0);
    widget.fetch(clean, "English");
  }, []);

  // Si llegamos con ?q=algo, se busca solo al estar listo el widget.
  useEffect(() => {
    if (!ready || launched.current || !initialQuery.trim()) return;
    launched.current = true;
    runSearch(initialQuery);
  }, [ready, initialQuery, runSearch]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    runSearch(text);
  }

  function changeSpeed(rate: number) {
    widgetRef.current?.setSpeed(rate);
    setSpeed(rate);
  }

  const playing = status === "ready";

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="to have some awareness"
          aria-label="Frase o palabra en inglés"
          className={fieldClass}
        />
        <button
          type="submit"
          disabled={!ready || !text.trim()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 sm:w-32 sm:shrink-0"
        >
          Buscar
        </button>
      </form>

      {failed ? (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p>{failed}</p>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Casi siempre es un bloqueador de anuncios o una extensión del
            navegador. Desactívalo en esta página y vuelve a intentarlo.
          </p>
          <button
            type="button"
            onClick={() => {
              setFailed("");
              setAttempt((n) => n + 1);
            }}
            className="mt-4 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <p className="mt-4 min-h-5 text-sm text-neutral-600 dark:text-neutral-400">
            {!ready && "Cargando el buscador…"}
            {ready && status === "idle" && "Escribe una frase y pulsa Buscar."}
            {status === "loading" && "Buscando…"}
            {status === "empty" &&
              "No se encontró esa frase. Prueba con menos palabras."}
            {playing && `Ejemplo ${track} de ${total}`}
          </p>

          {/* El widget se monta aquí dentro. */}
          <div
            ref={containerRef}
            className="mt-2 w-full overflow-x-auto [&_iframe]:max-w-full"
          >
            <div id={domId} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Control onClick={() => widgetRef.current?.previous()} disabled={!playing}>
              ← Anterior
            </Control>
            <Control onClick={() => widgetRef.current?.replay()} disabled={!playing}>
              Repetir
            </Control>
            <Control onClick={() => widgetRef.current?.next()} disabled={!playing}>
              Siguiente →
            </Control>
            <Control
              onClick={() => widgetRef.current?.move(-REWIND)}
              disabled={!playing}
              title={`Rebobina ${REWIND} segundos para oír lo de antes`}
            >
              ↺ Más contexto
            </Control>

            <span className="ml-auto flex items-center gap-1">
              {SPEEDS.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => changeSpeed(rate)}
                  disabled={!playing}
                  className={[
                    "rounded-lg border px-2.5 py-1.5 text-sm disabled:opacity-50",
                    speed === rate
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800",
                  ].join(" ")}
                >
                  {rate}x
                </button>
              ))}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Control({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
    >
      {children}
    </button>
  );
}
