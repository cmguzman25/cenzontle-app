"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Guarda una palabra en el banco del usuario. Si ya existe, no hace nada. */
export async function saveWord(input: {
  word: string;
  meaning?: string;
  lessonId?: string;
  sentenceId?: number;
  context?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "No has iniciado sesión." };

  const { error } = await supabase.from("words").upsert(
    {
      user_id: user.id,
      word: input.word,
      meaning: input.meaning ?? "",
      lesson_id: input.lessonId ?? null,
      sentence_id: input.sentenceId ?? null,
      context: input.context ?? null,
    },
    { onConflict: "user_id,word", ignoreDuplicates: true },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/words");
  return { ok: true };
}

/**
 * Deja el ajuste hecho para todo el mundo: es la misma historia y el mismo
 * audio para cualquiera que guarde esa palabra. Con `from`/`to` a null se
 * borra y todos vuelven a la estimación automática.
 */
export async function saveSharedWordTiming(input: {
  lessonId: string;
  sentenceId: number;
  term: string;
  from: number | null;
  to: number | null;
  /** Visto bueno del usuario: el trozo suena bien tal cual. */
  confirmed: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "No has iniciado sesión." };

  const term = input.term.trim().toLowerCase();
  if (!term) return { ok: false, error: "Palabra vacía." };

  const key = {
    lesson_id: input.lessonId,
    sentence_id: input.sentenceId,
    term,
  };

  if (input.from == null || input.to == null) {
    const { error } = await supabase.from("word_audio").delete().match(key);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await supabase.from("word_audio").upsert(
    {
      ...key,
      audio_start: input.from,
      audio_end: input.to,
      confirmed: input.confirmed,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lesson_id,sentence_id,term" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Quita una palabra del banco. */
export async function removeWord(word: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "No has iniciado sesión." };

  const { error } = await supabase
    .from("words")
    .delete()
    .eq("user_id", user.id)
    .eq("word", word);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/words");
  return { ok: true };
}

/** Marca o desmarca una palabra como ya conocida. */
export async function setWordKnown(
  id: string,
  known: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("words").update({ known }).eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/words");
  return { ok: true };
}

/** Borra una palabra por su id (usado desde la página /words). */
export async function deleteWordById(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("words").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/words");
  return { ok: true };
}

/**
 * Recuerda por qué frase va el usuario en esta lección. Se llama a menudo
 * mientras se ve el video, así que no revalida ninguna ruta.
 */
export async function saveLessonPosition(input: {
  lessonId: string;
  sentenceId: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "No has iniciado sesión." };

  const { error } = await supabase.from("lesson_position").upsert(
    {
      user_id: user.id,
      lesson_id: input.lessonId,
      sentence_id: input.sentenceId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Guarda el resultado de la evaluación de comprensión. */
export async function saveProgress(input: {
  lessonId: string;
  score: number;
  correct: number;
  total: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "No has iniciado sesión." };

  const { error } = await supabase.from("progress").insert({
    user_id: user.id,
    lesson_id: input.lessonId,
    score: input.score,
    correct: input.correct,
    total: input.total,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/lesson/${input.lessonId}`);
  return { ok: true };
}
