import Link from "next/link";

import SearchResults from "@/components/SearchResults";
import { MAX_HITS, searchSentences } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Buscar frases" };

/** Ejemplos para el primer encuentro, que una caja vacía no dice qué hacer. */
const EXAMPLES = ["data", "you know", "arquitectura", "of course"];

/**
 * Buscador de frases dentro de nuestras propias transcripciones.
 *
 * Va por la URL (`?q=algo`) y se resuelve en el servidor: así la búsqueda se
 * puede compartir y enlazar, el botón de atrás funciona, y no hay que esperar
 * a que cargue nada para ver resultados.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  // Esto enseña el texto de las transcripciones, que no es público: la página
  // de la lección pide entrar por lo mismo, y por aquí no se va a colar.
  //
  // Invitación en vez de redirección, como en "Mis palabras": este enlace está
  // en el menú para todo el mundo, y soltar a alguien en el login sin más
  // explicación no dice ni qué era esta página.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = query ? `/buscar?q=${encodeURIComponent(query)}` : "/buscar";

    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Buscar frases</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Busca una palabra o una frase en las transcripciones de todas las
          lecciones. Entra con tu correo para usarlo.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="mt-4 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          Entrar
        </Link>
      </main>
    );
  }

  // El banco de palabras, para que sombrear un trozo ya guardado ofrezca
  // quitarlo en vez de guardarlo otra vez.
  const [{ hits, truncated, scanned }, wordsResult] = await Promise.all([
    searchSentences(query),
    supabase.from("words").select("word"),
  ]);

  const savedWords = (wordsResult.data ?? []).map((row) => row.word as string);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Buscar frases</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Busca una palabra o una frase en las transcripciones de todas las
        lecciones. Puedes escribirla en inglés o en español. Pulsa un resultado
        y la lección se abre justo en esa frase.
      </p>

      {/* Un formulario de toda la vida: funciona con Enter y sin JavaScript. */}
      <form method="get" className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={query}
          // Solo al llegar en blanco: con resultados en pantalla, enfocar
          // levanta el teclado del móvil y los tapa justo al llegar.
          autoFocus={!query}
          placeholder="data architecture"
          aria-label="Palabra o frase"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          type="submit"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 sm:w-32 sm:shrink-0"
        >
          Buscar
        </button>
      </form>

      {!query ? (
        <div className="mt-8 rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <p className="text-neutral-600 dark:text-neutral-400">
            Por ejemplo:
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <Link
                  href={`/buscar?q=${encodeURIComponent(example)}`}
                  className="rounded-full bg-neutral-100 px-3 py-1 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                >
                  {example}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : hits.length === 0 ? (
        <div className="mt-8 rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <p>
            No hay ninguna frase con <strong>{query}</strong>.
          </p>
          <p className="mt-2 text-neutral-500 dark:text-neutral-400">
            Se miraron {scanned} frases. Prueba con menos palabras, o con una
            sola: se busca el texto tal cual, no por significado.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
            {truncated
              ? `Más de ${MAX_HITS} frases. Se enseñan las ${MAX_HITS} primeras.`
              : `${hits.length} ${hits.length === 1 ? "frase" : "frases"}.`}
          </p>

          <SearchResults
            hits={hits}
            query={query}
            initialSaved={savedWords}
          />
        </>
      )}
    </main>
  );
}
