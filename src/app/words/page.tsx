import Link from "next/link";

import WordList, { type WordRow } from "@/components/WordList";
import { createClient } from "@/lib/supabase/server";

export default async function WordsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Mis palabras</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Entra con tu correo para guardar y consultar tu banco de palabras.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          Entrar
        </Link>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("words")
    .select("id, word, meaning, lesson_id, known, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Mis palabras</h1>
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          No se pudo leer la tabla <code>words</code>: {error.message}
          <br />
          ¿Ejecutaste <code>supabase/schema.sql</code> en el SQL Editor?
        </p>
      </main>
    );
  }

  const words = (data ?? []) as WordRow[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Mis palabras</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {words.length} guardadas ·{" "}
        {words.filter((w) => w.known).length} marcadas como conocidas
      </p>

      <div className="mt-6">
        <WordList words={words} />
      </div>
    </main>
  );
}
