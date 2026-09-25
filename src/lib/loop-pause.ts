/**
 * El respiro que deja el bucle entre una vuelta y la siguiente.
 *
 * Sin él la frase enlaza con ella misma y no se distingue dónde acaba y dónde
 * vuelve a empezar, que es justo lo que hay que oír para repetirla. Cuánto
 * hace falta depende de quién escucha, así que se elige y se recuerda.
 *
 * Vive aparte porque lo usan la lección y el buscador de frases, y la
 * preferencia tiene que ser la misma en los dos sitios.
 */

export const LOOP_PAUSE_DEFAULT = 500;
export const LOOP_PAUSE_OPTIONS = [0, 500, 1000, 1500, 2000, 3000];
const LOOP_PAUSE_KEY = "listen-app:loop-pause";

/**
 * Lo que eligió el usuario la última vez. En el servidor no hay almacén, y el
 * navegador puede tenerlo bloqueado: en ambos casos se va al valor de siempre.
 */
export function readLoopPause(): number {
  if (typeof window === "undefined") return LOOP_PAUSE_DEFAULT;
  try {
    const ms = Number(window.localStorage.getItem(LOOP_PAUSE_KEY));
    return LOOP_PAUSE_OPTIONS.includes(ms) ? ms : LOOP_PAUSE_DEFAULT;
  } catch {
    return LOOP_PAUSE_DEFAULT;
  }
}

/** Deja apuntada la preferencia. Sin almacén vale para esta sesión y ya está. */
export function writeLoopPause(ms: number): void {
  try {
    window.localStorage.setItem(LOOP_PAUSE_KEY, String(ms));
  } catch {
    // Nada que hacer: el usuario tendrá que volver a elegirlo.
  }
}

/** `0,5 s`, `2 s`, `sin pausa`. */
export function formatLoopPause(ms: number): string {
  if (ms === 0) return "sin pausa";
  return `${(ms / 1000).toString().replace(".", ",")} s`;
}
