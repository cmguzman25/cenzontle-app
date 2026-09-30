import type { Sentence } from "@/lib/types";

/** Aire antes y después para no cortar el ataque ni el final de la palabra. */
const PAD_BEFORE = 0.25;
const PAD_AFTER = 0.35;
/** Por debajo de esto el fragmento no se entiende: casi ni suena. */
const MIN_LENGTH = 0.9;

export type Range = { from: number; to: number };

/**
 * Margen para no soltar la frase que ya está sonando.
 *
 * El reproductor avisa de la hora cada ~200 ms, así que el primer aviso
 * después de un salto puede llegar unas décimas ANTES del inicio de la frase a
 * la que acabamos de saltar.
 */
const STICKY_ACTIVE = 0.5;

/**
 * Qué frase hay que resaltar en un segundo dado.
 *
 * No basta con coger la primera que encaje. Los tiempos se cuadran a mano y es
 * normal que dos frases se solapen unas décimas; si además acabamos de saltar,
 * el primer aviso del reproductor puede llegar justo antes del inicio. Con la
 * regla ingenua el resaltado se iba a la frase de arriba y volvía enseguida:
 * un salto feo que distrae.
 *
 * Las reglas, por orden:
 *  1. La frase que ya está sonando se queda mientras el segundo siga siendo
 *     suyo, con algo de margen por delante.
 *  2. Si encajan varias, vale la última en empezar: si hemos entrado en una
 *     frase nueva, es esa y no la que se está terminando.
 *  3. Si no encaja ninguna (un hueco entre dos frases), devolvemos `null` y
 *     quien llama se queda con la que tenía.
 *
 * Como efecto de propina, cuadrar los tiempos a mano no tiene que ser exacto.
 */
export function pickActiveSentence(
  sentences: Sentence[],
  seconds: number,
  activeId: number | null,
): Sentence | null {
  if (activeId != null) {
    const active = sentences.find((s) => s.id === activeId);
    if (
      active &&
      seconds >= active.start - STICKY_ACTIVE &&
      seconds < active.end
    ) {
      return active;
    }
  }

  let current: Sentence | null = null;
  for (const sentence of sentences) {
    if (seconds >= sentence.start && seconds < sentence.end) current = sentence;
  }
  return current;
}

/**
 * Estima en qué segundos suena `term` dentro de la frase.
 *
 * La transcripción solo trae tiempos por frase, así que repartimos su duración
 * a lo largo del texto: donde cae la palabra en los caracteres, ahí cae en el
 * audio. No es exacto —nadie habla a velocidad constante— pero para escuchar
 * un trozo suelto basta, y el margen de los `PAD` absorbe la desviación.
 *
 * Devuelve `null` si la palabra no está en la frase (guardada sobre otra
 * versión del texto, por ejemplo): quien llame decide qué hacer.
 */
export function estimateWordRange(
  sentence: Sentence,
  term: string,
  /** Carácter en el que empieza, si quien llama ya lo sabe. */
  knownAt?: number,
): Range | null {
  const text = sentence.en;
  const clean = term.trim();
  if (!clean || !text) return null;

  // Sin posición conocida buscamos la primera aparición; si la palabra sale
  // dos veces en la frase, sonará la primera.
  const at =
    knownAt != null && knownAt >= 0
      ? knownAt
      : text.toLowerCase().indexOf(clean.toLowerCase());
  if (at < 0) return null;

  const duration = sentence.end - sentence.start;
  if (duration <= 0) return null;

  const perChar = duration / text.length;
  let from = sentence.start + at * perChar - PAD_BEFORE;
  let to = sentence.start + (at + clean.length) * perChar + PAD_AFTER;

  // Un fragmento demasiado corto se alarga por el final, que es donde menos
  // molesta: empezar antes de tiempo se nota más que terminar tarde.
  if (to - from < MIN_LENGTH) to = from + MIN_LENGTH;

  // Nunca nos salimos de la frase.
  from = Math.max(sentence.start, from);
  to = Math.min(sentence.end, to);
  if (to <= from) return { from: sentence.start, to: sentence.end };

  return { from, to };
}

/** Cuánto se puede sacar el trozo fuera de su frase al ajustarlo a mano. */
const SLACK = 3;
/** Un trozo más corto que esto no se oye. */
const MIN_SPAN = 0.3;

/**
 * Mantiene el trozo dentro de unos límites razonables: cerca de su frase (con
 * algo de margen, porque a veces los tiempos de la transcripción bailan) y sin
 * que el final se cruce con el principio.
 */
export function clampRange(sentence: Sentence, range: Range): Range {
  const floor = Math.max(0, sentence.start - SLACK);
  const ceiling = sentence.end + SLACK;

  const from = Math.min(Math.max(range.from, floor), ceiling - MIN_SPAN);
  const to = Math.min(Math.max(range.to, from + MIN_SPAN), ceiling);

  return { from: round(from), to: round(to) };
}

/** Cuánto se puede mover una frase entera respecto a lo que dice el guion. */
const SENTENCE_SLACK = 10;
/** Una frase más corta que esto no dice nada. */
const MIN_SENTENCE = 0.5;

/**
 * Igual que `clampRange`, pero para mover la frase entera. Aquí el margen es
 * más ancho: los tiempos de los subtítulos automáticos se desfasan varios
 * segundos, y el tope se mide siempre contra el guion original para que a base
 * de flechas la frase no se vaya a la otra punta del video.
 */
export function clampSentenceRange(original: Sentence, range: Range): Range {
  const floor = Math.max(0, original.start - SENTENCE_SLACK);
  const ceiling = original.end + SENTENCE_SLACK;

  const from = Math.min(Math.max(range.from, floor), ceiling - MIN_SENTENCE);
  const to = Math.min(Math.max(range.to, from + MIN_SENTENCE), ceiling);

  return { from: round(from), to: round(to) };
}

/**
 * ¿El trozo suena dentro de su frase, o es de otra?
 *
 * Una misma palabra sale en varias frases y cada aparición tiene su sitio en el
 * audio. Con esto descartamos un ajuste que se guardó pensando en otra frase:
 * mejor la estimación que mandar al usuario a un segundo que no es.
 */
export function overlapsSentence(sentence: Sentence, range: Range): boolean {
  const overlap =
    Math.min(range.to, sentence.end) - Math.max(range.from, sentence.start);
  return overlap > 0;
}

/** Dos decimales: ni el audio ni la pantalla necesitan más. */
function round(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}
