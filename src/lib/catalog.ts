import type { LessonSummary } from "@/lib/types";

export type Status = "progreso" | "terminada" | "nueva";

/** Lo que el usuario lleva hecho, sacado de Supabase. */
export type Progress = {
  /** id de lección → frase por la que va */
  positions: Map<string, number>;
  /** id de lección → mejor resultado del quiz */
  bestScores: Map<string, number>;
};

export const NO_PROGRESS: Progress = {
  positions: new Map(),
  bestScores: new Map(),
};

/**
 * Un capítulo: el video entero, partido en lecciones cortas y ordenadas.
 * Las lecciones sueltas (sin `seriesId`) no forman capítulo.
 */
export type Chapter = {
  id: string;
  title: string;
  youtubeId: string;
  lessons: LessonSummary[];
};

/** Una tarjeta de la portada: o un capítulo entero, o una lección suelta. */
export type CatalogItem = {
  key: string;
  href: string;
  title: string;
  youtubeId: string;
  description?: string;
  /** Todos los niveles que aparecen dentro. Para el filtro de nivel. */
  levels: string[];
  categories: string[];
  status: Status;
  /** Cuántas partes tiene el capítulo. `null` en lecciones sueltas. */
  parts: number | null;
  partsDone: number;
  /** Avance en tanto por ciento, o `null` si no ha empezado. */
  percent: number | null;
  /** Texto del pie de la tarjeta. */
  hint?: string;
};

/** Una lección está terminada cuando hizo el quiz; en progreso si la abrió. */
export function lessonStatus(id: string, progress: Progress): Status {
  if (progress.bestScores.has(id)) return "terminada";
  if (progress.positions.has(id)) return "progreso";
  return "nueva";
}

/** Reparte las lecciones entre capítulos (en orden) y lecciones sueltas. */
export function groupIntoChapters(lessons: LessonSummary[]): {
  chapters: Chapter[];
  loose: LessonSummary[];
} {
  const chapters = new Map<string, Chapter>();
  const loose: LessonSummary[] = [];

  for (const lesson of lessons) {
    if (!lesson.seriesId) {
      loose.push(lesson);
      continue;
    }

    let chapter = chapters.get(lesson.seriesId);
    if (!chapter) {
      chapter = {
        id: lesson.seriesId,
        title: lesson.seriesTitle ?? lesson.seriesId,
        youtubeId: lesson.youtubeId,
        lessons: [],
      };
      chapters.set(lesson.seriesId, chapter);
    }
    chapter.lessons.push(lesson);
  }

  for (const chapter of chapters.values()) {
    chapter.lessons.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  return { chapters: [...chapters.values()], loose };
}

/** Busca un capítulo por su id. */
export function findChapter(
  lessons: LessonSummary[],
  id: string,
): Chapter | null {
  return groupIntoChapters(lessons).chapters.find((c) => c.id === id) ?? null;
}

/**
 * Sitúa una lección dentro de su capítulo: qué parte es y cuáles tiene al lado.
 * Devuelve `chapter: null` si la lección va suelta.
 */
export function lessonNeighbours(
  lessons: LessonSummary[],
  id: string,
): {
  chapter: Chapter | null;
  part: number;
  total: number;
  previous: LessonSummary | null;
  next: LessonSummary | null;
} {
  const empty = {
    chapter: null,
    part: 0,
    total: 0,
    previous: null,
    next: null,
  };

  const summary = lessons.find((l) => l.id === id);
  if (!summary?.seriesId) return empty;

  const chapter = findChapter(lessons, summary.seriesId);
  if (!chapter) return empty;

  const index = chapter.lessons.findIndex((l) => l.id === id);
  if (index === -1) return empty;

  return {
    chapter,
    part: index + 1,
    total: chapter.lessons.length,
    previous: chapter.lessons[index - 1] ?? null,
    next: chapter.lessons[index + 1] ?? null,
  };
}

/**
 * Por dónde seguir dentro de un capítulo: la primera parte sin terminar.
 * Si están todas hechas, devuelve la primera (para repasar).
 */
export function nextLesson(
  chapter: Chapter,
  progress: Progress,
): { lesson: LessonSummary; part: number } | null {
  if (chapter.lessons.length === 0) return null;

  const index = chapter.lessons.findIndex(
    (l) => !progress.bestScores.has(l.id),
  );
  const at = index === -1 ? 0 : index;

  return { lesson: chapter.lessons[at], part: at + 1 };
}

/** Arma las tarjetas de la portada. */
export function buildCatalog(
  lessons: LessonSummary[],
  progress: Progress,
): CatalogItem[] {
  const { chapters, loose } = groupIntoChapters(lessons);

  const chapterItems: CatalogItem[] = chapters.map((chapter) => {
    const parts = chapter.lessons.length;
    const partsDone = chapter.lessons.filter((l) =>
      progress.bestScores.has(l.id),
    ).length;
    const started = chapter.lessons.some(
      (l) => progress.positions.has(l.id) || progress.bestScores.has(l.id),
    );

    const status: Status =
      partsDone === parts && parts > 0
        ? "terminada"
        : started
          ? "progreso"
          : "nueva";

    const next = nextLesson(chapter, progress);

    return {
      key: `chapter:${chapter.id}`,
      href: `/capitulo/${chapter.id}`,
      title: chapter.title,
      youtubeId: chapter.youtubeId,
      description: chapter.lessons[0]?.description,
      levels: [...new Set(chapter.lessons.map((l) => l.level))].sort(),
      categories: [
        ...new Set(chapter.lessons.flatMap((l) => l.categories ?? [])),
      ].sort((a, b) => a.localeCompare(b, "es")),
      status,
      parts,
      partsDone,
      percent: parts > 0 ? Math.round((partsDone / parts) * 100) : null,
      hint:
        status === "terminada"
          ? "Capítulo completo"
          : next
            ? `${started ? "Continuar" : "Empezar"}: Parte ${next.part} · ${next.lesson.title}`
            : undefined,
    };
  });

  const looseItems: CatalogItem[] = loose.map((lesson) => ({
    key: `lesson:${lesson.id}`,
    href: `/lesson/${lesson.id}`,
    title: lesson.title,
    youtubeId: lesson.youtubeId,
    description: lesson.description,
    levels: [lesson.level],
    categories: lesson.categories ?? [],
    status: lessonStatus(lesson.id, progress),
    parts: null,
    partsDone: 0,
    percent: null,
  }));

  return [...chapterItems, ...looseItems];
}
