import Link from "next/link";
import { redirect } from "next/navigation";

import ReviewList, { type ReviewedLesson } from "@/components/ReviewList";
import { lessonNeighbours } from "@/lib/catalog";
import { getLessons } from "@/lib/lessons";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mis repasos" };

export default async function RepasoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent("/repaso")}`);

  const [lessons, reviewResult] = await Promise.all([
    getLessons(),
    supabase.from("lesson_review").select("lesson_id, times, last_at"),
  ]);

  // Solo lo revisado al menos una vez, y solo lo que sigue existiendo: el
  // catálogo vive en archivos y una parte puede haberse quitado o renombrado.
  const reviewed: ReviewedLesson[] = (reviewResult.data ?? []).flatMap(
    (row) => {
      const id = row.lesson_id as string;
      const summary = lessons.find((l) => l.id === id);
      if (!summary) return [];

      const { chapter, part, total } = lessonNeighbours(lessons, id);

      return [
        {
          id,
          title: summary.title,
          level: summary.level,
          chapterTitle: chapter?.title,
          part: chapter ? part : undefined,
          total: chapter ? total : undefined,
          times: row.times as number,
          lastAt: row.last_at as string,
        },
      ];
    },
  );

  const vueltas = reviewed.reduce((sum, l) => sum + l.times, 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
        >
          ← Todos los capítulos
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">Mis repasos</h1>

        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {reviewed.length === 0
            ? "Aquí van a ir las partes que des por revisadas."
            : `${reviewed.length} ${reviewed.length === 1 ? "parte revisada" : "partes revisadas"} · ${vueltas} ${vueltas === 1 ? "vuelta" : "vueltas"} en total.`}
        </p>
      </header>

      {reviewed.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          Todavía no has marcado ninguna parte como revisada. El botón{" "}
          <strong>✅ Marcar como revisada</strong> está al final de los
          controles de cada lección, debajo del reproductor.
        </p>
      ) : (
        <ReviewList lessons={reviewed} />
      )}
    </main>
  );
}
