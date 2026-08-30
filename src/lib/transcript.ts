/**
 * Parser de transcripciones.
 *
 * Soporta el formato que sale al copiar desde YouTube ("Mostrar transcripción"),
 * donde cada línea trae la marca de tiempo pegada a una descripción larga y al
 * texto, por ejemplo:
 *
 *   0:1212 secondsNow, where's my to-do list?
 *   1:041 minute, 4 secondsBut isn't the supermarket above the ground?
 *
 * También acepta el formato simple `0:12 texto` y `.vtt` / `.srt` básicos.
 */

export type Cue = {
  /** Segundo en el que empieza. */
  start: number;
  text: string;
};

/** Marcas de sonido que no son diálogo: [laughter], [music], (snorts)... */
const SOUND_MARKER = /[[(][^\])]*[\])]/g;

/** `0:12`, `1:04`, `1:02:33` al principio de la línea. */
const TIMESTAMP = /^\s*(?:(\d+):)?(\d{1,2}):(\d{2})/;

/**
 * Descripción larga que YouTube pega justo después de la marca de tiempo:
 * "12 seconds", "1 minute, 4 seconds", "5 minutes", "1 hour, 2 minutes"...
 */
const HUMAN_DURATION =
  /^\s*(?:\d+\s*hours?,?\s*)?(?:\d+\s*minutes?,?\s*)?(?:\d+\s*seconds?)?/i;

function toSeconds(h: string | undefined, m: string, s: string): number {
  return (h ? Number(h) * 3600 : 0) + Number(m) * 60 + Number(s);
}

/** Convierte el texto de una transcripción en una lista de intervenciones. */
export function parseTranscript(raw: string): Cue[] {
  const cues: Cue[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const match = TIMESTAMP.exec(line);
    if (!match) continue;

    const start = toSeconds(match[1], match[2], match[3]);
    let text = line.slice(match[0].length);

    // Quitamos la descripción larga de YouTube, si está.
    text = text.replace(HUMAN_DURATION, "");

    // Quitamos las marcas de sonido y normalizamos espacios.
    text = text.replace(SOUND_MARKER, " ").replace(/\s+/g, " ").trim();

    if (!text) continue;

    cues.push({ start, text });
  }

  return dedupe(cues);
}

/** Si dos marcas caen en el mismo segundo, unimos su texto. */
function dedupe(cues: Cue[]): Cue[] {
  const result: Cue[] = [];

  for (const cue of cues) {
    const last = result[result.length - 1];
    if (last && last.start === cue.start) {
      last.text = `${last.text} ${cue.text}`.trim();
    } else {
      result.push(cue);
    }
  }

  return result;
}

/** Devuelve solo los cues dentro de un rango de segundos. */
export function sliceCues(cues: Cue[], startAt = 0, endAt = Infinity): Cue[] {
  return cues.filter((cue) => cue.start >= startAt && cue.start < endAt);
}
