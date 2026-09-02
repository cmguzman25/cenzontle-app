"use client";

import type { Range } from "@/lib/word-timing";

/** Cuánto mueve cada toque de flecha. */
const STEP = 0.2;

type Props = {
  word: string;
  range: Range;
  /** `true` si estos segundos están guardados y no son la estimación. */
  tuned: boolean;
  /** El ajuste venía hecho de otra persona. */
  fromOthers: boolean;
  /** Visto bueno: lo pone el usuario con el botón, nunca solo. */
  confirmed: boolean;
  onChange: (range: Range) => void;
  onToggleConfirmed: () => void;
  onReset: () => void;
  onPlay: () => void;
  onClose: () => void;
};

/**
 * Ajuste fino del trozo de audio de una palabra. La estimación por caracteres
 * falla cuando el narrador hace pausas, así que el usuario corre el principio
 * y el final a golpe de flecha hasta que suena bien.
 */
export default function WordTuner({
  word,
  range,
  tuned,
  fromOthers,
  confirmed,
  onChange,
  onToggleConfirmed,
  onReset,
  onPlay,
  onClose,
}: Props) {
  const move = (edge: "from" | "to", delta: number) =>
    onChange({ ...range, [edge]: range[edge] + delta });

  return (
    // Flotante abajo: se llega aquí desde el banco de palabras o desde la
    // transcripción, que están en columnas distintas (y en el móvil, lejos).
    <div className="fixed bottom-3 left-1/2 z-40 w-[min(30rem,94vw)] -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-lg dark:border-amber-500/40 dark:bg-amber-950 dark:shadow-black/40">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPlay}
          title="Escuchar el trozo"
          className="rounded-md bg-amber-600 px-2.5 py-1 text-sm text-white hover:bg-amber-700"
        >
          ▶
        </button>

        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {word}
        </span>

        <button
          type="button"
          onClick={onToggleConfirmed}
          aria-pressed={confirmed}
          title={
            confirmed
              ? "Quitar la marca de comprobado"
              : "Marcar este trozo como comprobado"
          }
          className={[
            "rounded-md px-2 py-1 text-sm transition-colors",
            confirmed
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "border border-amber-300 hover:bg-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-500/20",
          ].join(" ")}
        >
          ✓{confirmed ? " Comprobado" : " Está bien"}
        </button>

        <button
          type="button"
          onClick={onClose}
          title="Cerrar el ajuste"
          className="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-amber-100 dark:text-neutral-400 dark:hover:bg-amber-500/20"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Edge
          label="Inicio"
          value={range.from}
          onLess={() => move("from", -STEP)}
          onMore={() => move("from", STEP)}
        />
        <Edge
          label="Fin"
          value={range.to}
          onLess={() => move("to", -STEP)}
          onMore={() => move("to", STEP)}
        />
      </div>

      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        {tuned ? (
          <>
            {confirmed
              ? "Comprobado: sale con ✓ para todos. "
              : fromOthers
                ? "Ya venía ajustado, sin comprobar. "
                : "Ajustado, sin comprobar. "}
            <button
              type="button"
              onClick={onReset}
              className="underline hover:no-underline"
            >
              Volver a la estimación
            </button>
          </>
        ) : (
          "Estimado. Muévelo con las flechas y queda ajustado para todos."
        )}
      </p>
    </div>
  );
}

function Edge({
  label,
  value,
  onLess,
  onMore,
}: {
  label: string;
  value: number;
  onLess: () => void;
  onMore: () => void;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <button
        type="button"
        onClick={onLess}
        title={`${label}: ${STEP}s antes`}
        className="rounded-md border border-amber-300 px-2 py-0.5 hover:bg-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-500/20"
      >
        ◀
      </button>
      <span className="w-14 text-center font-mono text-xs">
        {value.toFixed(2)}s
      </span>
      <button
        type="button"
        onClick={onMore}
        title={`${label}: ${STEP}s después`}
        className="rounded-md border border-amber-300 px-2 py-0.5 hover:bg-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-500/20"
      >
        ▶
      </button>
    </span>
  );
}
