import Link from "next/link";

import { getLessons } from "@/lib/lessons";

export default async function Home() {
  const lessons = await getLessons();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Frase a Frase</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Escucha videos en inglés con la transcripción frase por frase, repite lo
        que no entiendas y guarda las palabras nuevas.
      </p>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Lecciones
      </h2>

      <ul className="mt-3 flex flex-col gap-2">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link
              href={`/lesson/${lesson.id}`}
              className="block rounded-xl border border-neutral-200 p-4 transition-colors hover:border-sky-400 hover:bg-sky-50 dark:border-neutral-800 dark:hover:border-sky-500 dark:hover:bg-sky-950/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{lesson.title}</span>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {lesson.level}
                </span>
              </div>
              {lesson.description && (
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {lesson.description}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {lessons.length === 0 && (
        <p className="mt-3 text-sm text-neutral-500">
          Todavía no hay lecciones en <code>content/lessons/</code>.
        </p>
      )}
    </main>
  );
}
