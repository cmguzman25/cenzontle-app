import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  findChapter,
  lessonStatus,
  nextLesson,
  NO_PROGRESS,
  type Progress,
} from "@/lib/catalog";
import { getLesson, getLessons } from "@/lib/lessons";
import { createClient } from "@/lib/supabase/server";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const chapter = findChapter(await getLessons(), id);
  if (!chapter) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let progress: Progress = NO_PROGRESS;

  if (user) {
    const [positionResult, progressResult] = await Promise.all([
      supabase.from("lesson_position").select("lesson_id, sentence_id"),
      supabase.from("progress").select("lesson_id, score"),
    ]);

    const positions = new Map<string, number>();
    const bestScores = new Map<string, number>();

    for (const row of positionResult.data ?? []) {
      positions.set(row.lesson_id as string, row.sentence_id as number);
    }

    for (const row of progressResult.data ?? []) {
      const lessonId = row.lesson_id as string;
      const score = row.score as number;
      bestScores.set(lessonId, Math.max(bestScores.get(lessonId) ?? 0, score));
    }

    progress = { positions, bestScores };
  }

  // Cuántas frases tiene cada parte, para que se vea lo que va a costar.
  const resolved = await Promise.all(
    chapter.lessons.map((lesson) => getLesson(lesson.id)),
  );
  const sentenceCount = new Map(
    chapter.lessons.map((lesson, i) => [
      lesson.id,
      resolved[i]?.sentences.length ?? 0,
    ]),
  );

  const done = chapter.lessons.filter((l) =>
    progress.bestScores.has(l.id),
  ).length;
  const percent = Math.round((done / chapter.lessons.length) * 100);
  const next = nextLesson(chapter, progress);
  const started = done > 0 || chapter.lessons.some((l) => progress.positions.has(l.id));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
      >
        ← Todos los capítulos
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-neutral-200 sm:w-56 dark:bg-neutral-800">
          <Image
            src={`https://i.ytimg.com/vi/${chapter.youtubeId}/hqdefault.jpg`}
            alt=""
            fill
            sizes="224px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{chapter.title}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {chapter.lessons.length} partes · Niveles{" "}
            {[...new Set(chapter.lessons.map((l) => l.level))].sort().join(", ")}
          </p>

          {user && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {done} de {chapter.lessons.length} partes terminadas
              </p>
            </div>
          )}

          {next && (
            <Link
              href={`/lesson/${next.lesson.id}`}
              className="mt-3 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              ▸ {started ? "Continuar" : "Empezar"} por la parte {next.part}
            </Link>
          )}
        </div>
      </div>

      <ol className="mt-8 flex flex-col gap-2">
        {chapter.lessons.map((lesson, index) => {
          const status = user ? lessonStatus(lesson.id, progress) : "nueva";
          const isNext = user && next?.lesson.id === lesson.id && started;
          const score = progress.bestScores.get(lesson.id);

          const mark =
            status === "terminada" ? "✓" : status === "progreso" ? "▸" : "";

          return (
            <li key={lesson.id}>
              <Link
                href={`/lesson/${lesson.id}`}
                className={[
                  "flex items-start gap-3 rounded-xl border p-4 transition-colors",
                  isNext
                    ? "border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40"
                    : "border-neutral-200 hover:border-sky-400 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-sky-500 dark:hover:bg-neutral-900",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    status === "terminada"
                      ? "bg-emerald-500 text-white"
                      : status === "progreso"
                        ? "bg-sky-500 text-white"
                        : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
                  ].join(" ")}
                >
                  {mark || index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Parte {index + 1} ·{" "}
                    </span>
                    {lesson.title}
                  </p>

                  {lesson.description && (
                    <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                      {lesson.description}
                    </p>
                  )}

                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Nivel {lesson.level} · {sentenceCount.get(lesson.id)} frases
                    {score != null && <> · mejor resultado {score}%</>}
                    {status === "progreso" && <> · vas por aquí</>}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
