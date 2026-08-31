import Link from "next/link";

import Catalog from "@/components/Catalog";
import { buildCatalog, NO_PROGRESS, type Progress } from "@/lib/catalog";
import { getLessons } from "@/lib/lessons";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const lessons = await getLessons();

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
          para abrir las lecciones, guardar palabras y que la app recuerde por
          dónde ibas.
        </p>
      )}

      <Catalog
        items={buildCatalog(lessons, progress)}
        isLoggedIn={Boolean(user)}
      />
    </main>
  );
}
