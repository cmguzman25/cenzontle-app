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

/**
 * En qué carácter del texto original empieza cada trozo del `split`. Como
 * `split` con grupo de captura no pierde nada, basta con ir sumando.
 */
function charOffsets(parts: string[]): number[] {
  const starts: number[] = [];
  let at = 0;
  for (const part of parts) {
    starts.push(at);
    at += part.length;
  }
  return starts;
}

type Props = {
  text: string;
  /** Salida de `buildHighlightPattern`. */
  pattern: RegExp | null;
  /**
   * Si se pasa, pulsar un resaltado avisa con el texto y en qué carácter del
   * texto empieza: así se distinguen dos apariciones de la misma palabra.
   */
  onMarkClick?: (term: string, at: number) => void;
};

/** Pinta el texto resaltando los trozos que están en el banco de palabras. */
export default function HighlightedText({
  text,
  pattern,
  onMarkClick,
}: Props) {
  if (!pattern) return <>{text}</>;

  // `split` con un grupo de captura intercala: [texto, coincidencia, texto, ...]
  const parts = text.split(pattern);

  // Sigue siendo un `mark` y no un `button`: hay que poder sombrear el texto
  // con el ratón por encima, que es como se guardan y se quitan palabras.
  function handleClick(term: string, at: number) {
    if (!onMarkClick) return;
    // Si hay algo sombreado el usuario está seleccionando, no pidiendo audio.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    onMarkClick(term, at);
  }

  const starts = charOffsets(parts);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            onClick={() => handleClick(part, starts[index])}
            title={onMarkClick ? "Escuchar este trozo" : undefined}
            className={[
              "rounded bg-amber-100 text-inherit underline decoration-amber-400 decoration-2 underline-offset-4 dark:bg-amber-500/20",
              onMarkClick ? "cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-500/30" : "",
            ].join(" ")}
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
