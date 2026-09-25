import { lessonNeighbours } from "@/lib/catalog";
import { getLesson, getLessons } from "@/lib/lessons";
import { includesFolded } from "@/lib/text";

/** Una frase encontrada, con lo que hace falta para situarla y abrirla. */
export type SearchHit = {
  lessonId: string;
  lessonTitle: string;
  /** Capítulo al que pertenece, si no va suelta. */
  chapterTitle?: string;
  part?: number;
  total?: number;
  /** Video de YouTube, para poder escuchar la frase sin salir del buscador. */
  youtubeId: string;
  sentenceId: number;
  /** Segundos del video entre los que suena. */
  start: number;
  end: number;
  en: string;
  es: string;
  /** La búsqueda cayó en la traducción y no en el inglés. */
  inSpanish: boolean;
};

/** Más de esto no se lee: son resultados para elegir, no para paginar. */
export const MAX_HITS = 100;

export type SearchResult = {
  hits: SearchHit[];
  /** Había más de `MAX_HITS` y se cortó la lista. */
  truncated: boolean;
  /** Cuántas frases se miraron, para poder decirlo en pantalla. */
  scanned: number;
};

/**
 * Busca una palabra o una frase en las transcripciones de todas las lecciones,
 * en el inglés y también en la traducción.
 *
 * Se lee todo el contenido en cada búsqueda y no hay índice: son unas pocas
 * decenas de kilobytes de texto y montar un índice para esto sería complicar
 * el arranque a cambio de milisegundos que nadie nota.
 */
export async function searchSentences(query: string): Promise<SearchResult> {
  const clean = query.trim();
  if (!clean) return { hits: [], truncated: false, scanned: 0 };

  const summaries = await getLessons();
  const lessons = await Promise.all(summaries.map((s) => getLesson(s.id)));

  const hits: SearchHit[] = [];
  let scanned = 0;
  let truncated = false;

  for (const [index, lesson] of lessons.entries()) {
    if (!lesson) continue;

    const summary = summaries[index];
    const { chapter, part, total } = lessonNeighbours(summaries, lesson.id);

    for (const sentence of lesson.sentences) {
      scanned++;

      const inEnglish = includesFolded(sentence.en, clean);
      const inSpanish = !inEnglish && includesFolded(sentence.es, clean);
      if (!inEnglish && !inSpanish) continue;

      if (hits.length >= MAX_HITS) {
        truncated = true;
        continue;
      }

      hits.push({
        lessonId: lesson.id,
        lessonTitle: summary.title,
        chapterTitle: chapter?.title,
        part: chapter ? part : undefined,
        total: chapter ? total : undefined,
        youtubeId: lesson.youtubeId,
        sentenceId: sentence.id,
        start: sentence.start,
        end: sentence.end,
        en: sentence.en,
        es: sentence.es,
        inSpanish,
      });
    }
  }

  return { hits, truncated, scanned };
}
