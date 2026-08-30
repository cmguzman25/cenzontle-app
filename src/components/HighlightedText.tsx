"use client";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Construye una expresión regular que encuentra cualquiera de los términos
 * guardados dentro de una frase. Funciona igual con una palabra suelta
 * ("burrow") que con una expresión ("didn't see that coming").
 *
 * Devuelve `null` si no hay nada que resaltar.
 */
export function buildHighlightPattern(terms: Iterable<string>): RegExp | null {
  const cleaned = [...terms]
    .map((term) => term.trim())
    .filter(Boolean)
    // Las expresiones más largas primero: así "see that coming" gana sobre "see".
    .sort((a, b) => b.length - a.length);

  if (cleaned.length === 0) return null;

  const alternatives = cleaned.map(escapeRegExp).join("|");

  try {
    // Los lookarounds evitan resaltar dentro de otra palabra
    // (que "on" no se marque dentro de "Come").
    return new RegExp(
      `(?<![\\p{L}\\p{N}])(${alternatives})(?![\\p{L}\\p{N}])`,
      "giu",
    );
  } catch {
    // Navegador sin soporte de lookbehind: caemos a una versión más simple.
    try {
      return new RegExp(`\\b(${alternatives})\\b`, "gi");
    } catch {
      return null;
    }
  }
}

type Props = {
  text: string;
  /** Salida de `buildHighlightPattern`. */
  pattern: RegExp | null;
};

/** Pinta el texto resaltando los trozos que están en el banco de palabras. */
export default function HighlightedText({ text, pattern }: Props) {
  if (!pattern) return <>{text}</>;

  // `split` con un grupo de captura intercala: [texto, coincidencia, texto, ...]
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="rounded bg-amber-100 text-inherit underline decoration-amber-400 decoration-2 underline-offset-4 dark:bg-amber-500/20"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
