import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import LessonView, { type SavedWord } from "@/components/LessonView";
import { lessonNeighbours } from "@/lib/catalog";
import { getLesson, getLessons } from "@/lib/lessons";
import { createClient } from "@/lib/supabase/server";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Las transcripciones no son públicas: hay que entrar para leerlas.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/lesson/${id}`)}`);
  }

  const lesson = await getLesson(id);
  if (!lesson) notFound();

  const { chapter, part, total, previous, next } = lessonNeighbours(
    await getLessons(),
    id,
  );

  const [wordsResult, progressResult, positionResult] = await Promise.all([
    supabase.from("words").select("word, meaning, lesson_id, sentence_id"),
    supabase
      .from("progress")
      .select("score, completed_at")
      .eq("lesson_id", lesson.id)
      .order("completed_at", { ascending: false })
      .limit(5),
    supabase
      .from("lesson_position")
      .select("sentence_id")
      .eq("lesson_id", lesson.id)
      .maybeSingle(),
  ]);

  const initialWords: SavedWord[] = (wordsResult.data ?? []).map((row) => ({
    word: row.word as string,
    meaning: (row.meaning as string) ?? "",
    lessonId: (row.lesson_id as string) ?? lesson.id,
    sentenceId: (row.sentence_id as number) ?? 0,
  }));

  const history = (progressResult.data ?? []) as {
    score: number;
    completed_at: string;
  }[];

  // Solo vale si la frase sigue existiendo (la lección pudo cambiar).
  const saved = positionResult.data?.sentence_id as number | undefined;
  const initialSentenceId =
    saved != null && lesson.sentences.some((s) => s.id === saved) ? saved : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6">
        <Link
          href={chapter ? `/capitulo/${chapter.id}` : "/"}
          className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
        >
          ← {chapter ? chapter.title : "Todos los capítulos"}
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">
          {chapter && (
            <span className="text-neutral-500 dark:text-neutral-400">
              Parte {part} ·{" "}
            </span>
          )}
          {lesson.title}
        </h1>

        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {chapter && <>Parte {part} de {total} · </>}
          Nivel {lesson.level} · {lesson.sentences.length} frases
        </p>

        {history.length > 0 && (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Intentos anteriores:{" "}
            {history
              .map(
                (h) =>
                  `${h.score}% (${new Date(h.completed_at).toLocaleDateString("es")})`,
              )
              .join(" · ")}
          </p>
        )}
      </header>

      <LessonView
        lesson={lesson}
        isLoggedIn
        initialWords={initialWords}
        initialSentenceId={initialSentenceId}
      />

      {chapter && (
        <nav className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          {previous ? (
            <Link
              href={`/lesson/${previous.id}`}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              ← Parte {part - 1} · {previous.title}
            </Link>
          ) : (
            <span />
          )}

          {next ? (
            <Link
              href={`/lesson/${next.id}`}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Parte {part + 1} · {next.title} →
            </Link>
          ) : (
            <Link
              href={`/capitulo/${chapter.id}`}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Última parte · volver al capítulo
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
