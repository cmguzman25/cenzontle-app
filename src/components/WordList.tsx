"use client";

import { useMemo, useState, useTransition } from "react";

import { deleteWordById, setWordKnown } from "@/lib/actions";

export type WordRow = {
  id: string;
  word: string;
  meaning: string;
  lesson_id: string | null;
  known: boolean;
  created_at: string;
};

export default function WordList({ words }: { words: WordRow[] }) {
  const [query, setQuery] = useState("");
  const [hideKnown, setHideKnown] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      if (hideKnown && w.known) return false;
      if (!q) return true;
      return (
        w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
      );
    });
  }, [words, query, hideKnown]);

  if (words.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        Todavía no has guardado ninguna palabra. Abre una lección y haz clic en
        las palabras que no entiendas.
      </p>
    );
  }

  return (
    <div className={pending ? "opacity-60 transition-opacity" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar…"
          className="min-w-40 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <input
            type="checkbox"
            checked={hideKnown}
            onChange={(e) => setHideKnown(e.target.checked)}
          />
          Ocultar las que ya sé
        </label>
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
        {filtered.map((w) => (
          <li key={w.id} className="flex items-center gap-3 py-2.5">
            <input
              type="checkbox"
              checked={w.known}
              title="Ya me la sé"
              onChange={(e) =>
                startTransition(async () => {
                  await setWordKnown(w.id, e.target.checked);
                })
              }
            />

            <div className="min-w-0 flex-1">
              <p
                className={
                  w.known ? "text-neutral-400 line-through" : "font-medium"
                }
              >
                {w.word}
              </p>
              <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                {w.meaning || "— sin significado guardado —"}
              </p>
            </div>

            {w.lesson_id && (
              <span className="hidden shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 sm:inline dark:bg-neutral-800 dark:text-neutral-400">
                {w.lesson_id}
              </span>
            )}

            <button
              type="button"
              title="Borrar"
              onClick={() =>
                startTransition(async () => {
                  await deleteWordById(w.id);
                })
              }
              className="shrink-0 rounded-md px-2 py-1 text-sm text-neutral-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">Nada coincide con la búsqueda.</p>
      )}
    </div>
  );
}
