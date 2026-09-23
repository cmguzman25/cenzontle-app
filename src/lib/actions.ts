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

/** Un ajuste de audio tal como lo necesita la lección. */
export type LessonTiming = {
  sentenceId: number;
  term: string;
  from: number;
  to: number;
  confirmed: boolean;
  updatedBy: string | null;
};

/**
 * Vuelve a leer los ajustes de audio de una lección.
 *
 * La página los trae una sola vez, al pintarse en el servidor. Como son de
 * todos y se tocan desde varios sitios (el móvil, el ordenador), hace falta
 * poder recogerlos otra vez sin recargar la lección entera.
 */
export async function getLessonTimings(
  lessonId: string,
): Promise<
  { ok: true; timings: LessonTiming[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión, la tabla no deja leer y devuelve cero filas en vez de un
  // error. Quien llame no podría distinguirlo de "aquí no hay nada ajustado"
  // y dejaría la pantalla sin ningún ajuste: hay que decirlo claro.
  if (!user) return { ok: false, error: "No has iniciado sesión." };

  const { data, error } = await supabase
    .from("word_audio")
    .select("sentence_id, term, audio_start, audio_end, confirmed, updated_by")
    .eq("lesson_id", lessonId);

  if (error) return { ok: false, error: error.message };

  const timings = (data ?? []).flatMap<LessonTiming>((row) => {
    // `numeric` de Postgres llega como texto.
    const from = Number(row.audio_start);
    const to = Number(row.audio_end);
    if (Number.isNaN(from) || Number.isNaN(to)) return [];
    return [
      {
        sentenceId: row.sentence_id as number,
        term: row.term as string,
        from,
        to,
        confirmed: Boolean(row.confirmed),
        updatedBy: (row.updated_by as string | null) ?? null,
      },
    ];
  });

  return { ok: true, timings };
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
 * Guarda la frase que el usuario marcó con 📍 en esta lección. La pone y la
 * quita él a mano; con `sentenceId` a null se borra la marca.
 *
 * No revalida ninguna ruta: la pantalla ya enseña la marca al momento y
 * recargar la lección entera por esto se nota mientras suena el video.
 */
export async function saveLessonPosition(input: {
  lessonId: string;
  sentenceId: number | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "No has iniciado sesión." };

  if (input.sentenceId == null) {
    const { error } = await supabase
      .from("lesson_position")
      .delete()
      .eq("user_id", user.id)
      .eq("lesson_id", input.lessonId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

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

/** Un repaso: cuántas vueltas le ha dado el usuario a una parte y cuándo. */
export type Review = {
  /** Siempre mayor que cero: sin repasos no hay fila. */
  times: number;
  /** ISO 8601, como lo devuelve Postgres. */
  lastAt: string;
};

/**
 * Suma un repaso a esta parte. La cuenta la lleva Postgres (`times + 1` sobre
 * la fila que ya hay), que desde aquí serían dos viajes y una carrera.
 */
export async function markLessonReviewed(
  lessonId: string,
): Promise<{ ok: true; review: Review } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "No has iniciado sesión." };

  const { data, error } = await supabase
    .rpc("mark_lesson_reviewed", { p_lesson_id: lessonId })
    .single();

  if (error) return { ok: false, error: error.message };

  const row = data as { times: number; last_at: string };

  revalidatePath("/repaso");
  return { ok: true, review: { times: row.times, lastAt: row.last_at } };
}

/**
 * Quita un repaso, para cuando se marcó sin querer. Al llegar a cero se borra
 * la fila: la parte vuelve a estar sin repasar y desaparece del listado.
 *
 * `last_at` se queda como estaba. Guardar la fecha de cada repaso para poder
 * retroceder a la anterior es mucha contabilidad para deshacer un clic.
 */
export async function unmarkLessonReviewed(
  lessonId: string,
): Promise<{ ok: true; review: Review | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "No has iniciado sesión." };

  const key = { user_id: user.id, lesson_id: lessonId };

  const { data: current, error: readError } = await supabase
    .from("lesson_review")
    .select("times, last_at")
    .match(key)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!current) return { ok: true, review: null };

  const times = (current.times as number) - 1;

  if (times <= 0) {
    const { error } = await supabase
      .from("lesson_review")
      .delete()
      .match(key);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/repaso");
    return { ok: true, review: null };
  }

  const { error } = await supabase
    .from("lesson_review")
    .update({ times })
    .match(key);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/repaso");
  return {
    ok: true,
    review: { times, lastAt: current.last_at as string },
  };
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
