import fs from "node:fs/promises";
import path from "node:path";

import { parseTranscript, sliceCues } from "@/lib/transcript";
import type {
  Annotation,
  Lesson,
  LessonSummary,
  ResolvedLesson,
  Sentence,
} from "@/lib/types";

const CONTENT_DIR = path.join(process.cwd(), "content");
const LESSONS_DIR = path.join(CONTENT_DIR, "lessons");
const TRANSCRIPTS_DIR = path.join(CONTENT_DIR, "transcripts");

/** Solo permitimos slugs simples: el id viene de la URL. */
const SAFE_SLUG = /^[a-z0-9-]+$/i;
const SAFE_FILENAME = /^[a-z0-9._-]+$/i;

/** Lee el listado de lecciones disponibles. */
export async function getLessons(): Promise<LessonSummary[]> {
  const raw = await fs.readFile(path.join(LESSONS_DIR, "index.json"), "utf8");
  return JSON.parse(raw) as LessonSummary[];
}

/**
 * Lee una lección y deja sus frases listas para pintar.
 *
 * Hay dos formas de escribir una lección:
 *  - `sentences`: el inglés y la traducción van en el propio JSON.
 *  - `transcript` + `annotations`: el inglés se lee del archivo de
 *    transcripción y el JSON solo aporta traducción, notas y vocabulario.
 */
export async function getLesson(id: string): Promise<ResolvedLesson | null> {
  if (!SAFE_SLUG.test(id)) return null;

  let lesson: Lesson;
  try {
    const raw = await fs.readFile(path.join(LESSONS_DIR, `${id}.json`), "utf8");
    lesson = JSON.parse(raw) as Lesson;
  } catch {
    return null;
  }

  const sentences = lesson.transcript
    ? await buildFromTranscript(lesson)
    : (lesson.sentences ?? []);

  return { ...lesson, sentences };
}

async function buildFromTranscript(lesson: Lesson): Promise<Sentence[]> {
  const file = lesson.transcript!;
  if (!SAFE_FILENAME.test(file)) return [];

  let raw: string;
  try {
    raw = await fs.readFile(path.join(TRANSCRIPTS_DIR, file), "utf8");
  } catch {
    return [];
  }

  const cues = sliceCues(
    parseTranscript(raw),
    lesson.startAt ?? 0,
    lesson.endAt ?? Infinity,
  );

  const byStart = new Map<number, Annotation>(
    (lesson.annotations ?? []).map((a) => [a.start, a]),
  );

  const limit = lesson.endAt ?? Infinity;

  return cues.map((cue, i) => {
    const annotation = byStart.get(cue.start);
    // La frase termina donde empieza la siguiente (o al final del trozo).
    const next = cues[i + 1]?.start ?? Math.min(cue.start + 6, limit);

    return {
      id: i + 1,
      start: cue.start,
      end: Math.max(next, cue.start + 1),
      // Si la transcripción automática se equivocó, usamos la corrección.
      en: annotation?.en ?? cue.text,
      es: annotation?.es ?? "",
      note: annotation?.note,
      tip: annotation?.tip,
      watch: annotation?.watch,
      vocab: annotation?.vocab,
    };
  });
}
