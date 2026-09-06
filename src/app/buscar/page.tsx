import PhraseSearch from "@/components/PhraseSearch";

export const metadata = { title: "Buscar frases" };

/**
 * Buscador de una frase en videos reales de YouTube.
 *
 * Acepta `?q=algo` para poder enlazar una búsqueda ya hecha (por ejemplo desde
 * el banco de palabras, más adelante).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Buscar frases</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Escribe una palabra o una frase en inglés y escúchala dicha por gente
        distinta, en situaciones distintas. Con <em>Siguiente</em> vas pasando de
        un ejemplo al otro.
      </p>

      <div className="mt-6">
        <PhraseSearch initialQuery={q ?? ""} />
      </div>

      <p className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        Los ejemplos vienen de YouGlish, que tiene indexados los subtítulos de
        millones de videos de YouTube.
      </p>
    </main>
  );
}
