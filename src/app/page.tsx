import Link from "next/link";

import LessonList, { type LessonCard } from "@/components/LessonList";
import { getLesson, getLessons } from "@/lib/lessons";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const summaries = await getLessons();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolvemos cada lección solo para saber cuántas frases tiene.
  const resolved = await Promise.all(summaries.map((s) => getLesson(s.id)));

  const positions = new Map<string, number>();
  const bestScores = new Map<string, number>();

  if (user) {
    const [positionResult, progressResult] = await Promise.all([
      supabase.from("lesson_position").select("lesson_id, sentence_id"),
      supabase.from("progress").select("lesson_id, score"),
    ]);

    for (const row of positionResult.data ?? []) {
      positions.set(row.lesson_id as string, row.sentence_id as number);
    }

    for (const row of progressResult.data ?? []) {
      const lessonId = row.lesson_id as string;
      const score = row.score as number;
      bestScores.set(lessonId, Math.max(bestScores.get(lessonId) ?? 0, score));
    }
  }

  const lessons: LessonCard[] = summaries.map((summary, i) => ({
    ...summary,
    totalSentences: resolved[i]?.sentences.length ?? 0,
    positionId: positions.get(summary.id) ?? null,
    bestScore: bestScores.get(summary.id) ?? null,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Frase a Frase</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Escucha videos en inglés con la transcripción frase por frase, repite lo
        que no entiendas y guarda las palabras nuevas.
      </p>

      {!user && (
        <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          <Link href="/login" className="font-medium underline">
            Entra en tu cuenta
          </Link>{" "}
          para guardar palabras y que la app recuerde por dónde ibas.
        </p>
      )}

      <LessonList lessons={lessons} isLoggedIn={Boolean(user)} />
    </main>
  );
}
