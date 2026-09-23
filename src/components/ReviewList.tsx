"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { parseDate, timeAgo } from "@/lib/dates";

/** Una parte ya revisada, con lo que hace falta para ordenarla y pintarla. */
export type ReviewedLesson = {
  id: string;
  title: string;
  level: string;
  /** Título del capítulo, si la parte pertenece a uno. */
  chapterTitle?: string;
  /** Qué parte es dentro del capítulo, empezando en 1. */
  part?: number;
  total?: number;
  times: number;
  lastAt: string;
};

type Order = "olvidadas" | "menos" | "aleatorio";

const ORDERS: { value: Order; label: string; hint: string }[] = [
  {
    value: "olvidadas",
    label: "Más olvidadas",
    hint: "Primero las que hace más tiempo que no repasas.",
  },
  {
    value: "menos",
    label: "Menos repasadas",
    hint: "Primero las que menos vueltas llevan.",
  },
  {
    value: "aleatorio",
    label: "Aleatorio",
    hint: "Al azar, para no repasar siempre en el mismo orden.",
  },
];

export default function ReviewList({ lessons }: { lessons: ReviewedLesson[] }) {
  const [order, setOrder] = useState<Order>("olvidadas");
  /**
   * El orden al azar, ya sorteado: ids de lección barajados.
   *
   * Se sortea al pulsar el botón y no al pintar la lista. Echándolo a suertes
   * durante el render, cada vez que React repintara saldría un orden distinto
   * y las tarjetas bailarían solas al tocar cualquier cosa.
   */
  const [shuffled, setShuffled] = useState<string[]>([]);

  /** Fisher-Yates sobre los ids. */
  const reshuffle = () => {
    const ids = lessons.map((l) => l.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setShuffled(ids);
  };

  const sorted = useMemo(() => {
    const list = [...lessons];

    if (order === "aleatorio") {
      const at = new Map(shuffled.map((id, i) => [id, i]));
      // Lo que no salió en el sorteo (una parte revisada en otra pestaña)
      // se va al final en vez de colarse en cabeza.
      return list.sort(
        (a, b) =>
          (at.get(a.id) ?? list.length) - (at.get(b.id) ?? list.length),
      );
    }

    if (order === "menos") {
      // A igualdad de repasos manda la más abandonada: entre dos que llevan
      // una sola vuelta, interesa antes la de hace un mes que la de ayer.
      return list.sort(
        (a, b) =>
          a.times - b.times || parseDate(a.lastAt) - parseDate(b.lastAt),
      );
    }

    return list.sort((a, b) => parseDate(a.lastAt) - parseDate(b.lastAt));
  }, [lessons, order, shuffled]);

  const active = ORDERS.find((o) => o.value === order);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {ORDERS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setOrder(o.value);
              // Entrar en "aleatorio" tiene que dar un orden nuevo, no el
              // mismo sorteo de la última vez.
              if (o.value === "aleatorio") reshuffle();
            }}
            aria-pressed={order === o.value}
            className={[
              "rounded-lg px-3 py-1.5 font-medium transition-colors",
              order === o.value
                ? "bg-sky-600 text-white hover:bg-sky-700"
                : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}

        {order === "aleatorio" && (
          <button
            type="button"
            onClick={reshuffle}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            🔀 Barajar
          </button>
        )}
      </div>

      {active && (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {active.hint}
        </p>
      )}

      <ol className="mt-4 flex flex-col gap-2">
        {sorted.map((lesson) => (
          <li key={lesson.id}>
            <Link
              href={`/lesson/${lesson.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-neutral-200 p-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {lesson.chapterTitle && (
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {lesson.chapterTitle} ·{" "}
                    </span>
                  )}
                  {lesson.part != null &&
                    `Parte ${lesson.part}${lesson.total ? ` de ${lesson.total}` : ""}: `}
                  {lesson.title}
                </span>
                <span className="block text-sm text-neutral-500 dark:text-neutral-400">
                  Nivel {lesson.level} · última vez {timeAgo(lesson.lastAt)}
                </span>
              </span>

              <span
                title={`Repasada ${lesson.times} ${lesson.times === 1 ? "vez" : "veces"}`}
                className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
              >
                ✅ {lesson.times}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
