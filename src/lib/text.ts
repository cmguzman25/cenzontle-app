/**
 * Comparar texto como lo compara una persona: sin distinguir mayúsculas ni
 * tildes. Aquí no se lee nada de disco, solo se manosean cadenas.
 */

/**
 * Deja un texto comparable: sin mayúsculas y sin tildes, para que "qué" y
 * "que" se encuentren igual.
 *
 * Va carácter a carácter a propósito. Quitando las tildes de golpe sobre el
 * texto entero cambia la longitud, y entonces la posición que devuelve el
 * buscador ya no sirve para cortar el texto original y resaltar el trozo.
 */
export function fold(text: string): string {
  let out = "";
  for (const ch of text) {
    const bare = ch.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    out += (bare || ch).toLowerCase();
  }
  return out;
}

/** Dónde empieza el trozo encontrado y cuánto ocupa en el texto original. */
export type Match = { at: number; length: number };

/**
 * Busca `query` dentro de `text` sin mirar tildes ni mayúsculas.
 *
 * Devuelve también el largo porque el trozo que hay que resaltar se mide en el
 * texto original, y ahí una letra puede ocupar más que en el texto comparable:
 * cortar por `query.length` marcaría de menos o de más.
 *
 * Si al quitar las tildes cambia la longitud (algún carácter raro), las
 * posiciones dejarían de cuadrar con el original: en ese caso se busca mirando
 * solo las mayúsculas, que encuentra menos pero nunca señala donde no es.
 */
export function findFolded(text: string, query: string): Match | null {
  const needle = fold(query);
  const folded = fold(text);

  if (folded.length === text.length) {
    const at = folded.indexOf(needle);
    return at < 0 ? null : { at, length: needle.length };
  }

  const plain = text.toLowerCase();
  const simple = query.toLowerCase();
  const at = plain.length === text.length ? plain.indexOf(simple) : -1;
  return at < 0 ? null : { at, length: simple.length };
}

/** ¿Está `query` en `text`? */
export function includesFolded(text: string, query: string): boolean {
  return findFolded(text, query) != null;
}
