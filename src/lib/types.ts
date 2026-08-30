export type VocabItem = {
  /** Palabra o expresión en inglés tal como aparece en la frase. */
  word: string;
  /** Significado en el idioma del estudiante. */
  meaning: string;
  /** Ejemplo corto de uso, en inglés. */
  example?: string;
};

export type Sentence = {
  id: number;
  /** Segundo en el que empieza la frase dentro del video. */
  start: number;
  /** Segundo en el que termina la frase. */
  end: number;
  /** Texto en inglés. */
  en: string;
  /** Traducción al idioma del estudiante. */
  es: string;
  /** Cómo funciona la frase: gramática, estructura. */
  note?: string;
  /** Cuándo y dónde se usa de verdad, con ejemplos. */
  tip?: string;
  /** Error común, falso amigo o detalle de pronunciación. */
  watch?: string;
  vocab?: VocabItem[];
};

/**
 * Anotación que le añadimos a una intervención de la transcripción.
 * Se enlaza por el segundo de inicio (`start`), que debe coincidir con el de
 * la transcripción.
 */
export type Annotation = {
  start: number;
  /** Traducción al idioma del estudiante. */
  es: string;
  /** Cómo funciona la frase: gramática, estructura. */
  note?: string;
  /** Cuándo y dónde se usa de verdad, con ejemplos. */
  tip?: string;
  /** Error común, falso amigo o detalle de pronunciación. */
  watch?: string;
  vocab?: VocabItem[];
  /**
   * Corrección del inglés. Los subtítulos automáticos de YouTube se equivocan
   * a menudo; aquí se pone la versión correcta.
   */
  en?: string;
};

export type QuizItem = {
  q: string;
  options: string[];
  /** Índice de la opción correcta dentro de `options`. */
  answer: number;
};

export type Lesson = {
  id: string;
  /** ID del video de YouTube (los 11 caracteres de la URL). */
  youtubeId: string;
  title: string;
  /** Nivel orientativo: A1, A2, B1, B2, C1. */
  level: string;
  description?: string;
  /**
   * Si el video es largo y esta lección es solo un trozo, `startAt` y `endAt`
   * marcan el segundo de inicio y de fin. El reproductor empieza en `startAt`
   * y se detiene en `endAt`.
   */
  startAt?: number;
  endAt?: number;
  /**
   * Nombre del archivo dentro de `content/transcripts/`. Si está presente, el
   * inglés se lee de ahí y `annotations` aporta la traducción y las notas.
   */
  transcript?: string;
  annotations?: Annotation[];
  /** Alternativa: escribir las frases a mano dentro del propio JSON. */
  sentences?: Sentence[];
  quiz: QuizItem[];
};

/** Lección ya resuelta: siempre tiene `sentences` lista para pintar. */
export type ResolvedLesson = Omit<Lesson, "sentences"> & {
  sentences: Sentence[];
};

/** Entrada del listado de lecciones (`content/lessons/index.json`). */
export type LessonSummary = {
  id: string;
  title: string;
  level: string;
  youtubeId: string;
  description?: string;
};
