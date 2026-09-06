/**
 * Capa fina sobre el widget de YouGlish.
 *
 * YouTube no deja buscar dentro de los subtítulos (su API busca en título,
 * descripción y etiquetas), así que para oír una frase dicha por gente distinta
 * hace falta un índice ya hecho. YouGlish es ese índice.
 *
 * Todo el trato con ellos vive aquí: si dejan de ser gratis o se pasa a un
 * índice propio, se cambia este archivo y la página sigue igual.
 */

/** Métodos del widget que usamos. */
export type YGWidget = {
  /** Lanza una búsqueda. `lang` va en inglés: "English", "Spanish"... */
  fetch(query: string, lang: string, accent?: string): void;
  play(): void;
  pause(): void;
  replay(): void;
  next(): void;
  previous(): void;
  /** Adelanta o retrocede. En negativo, hacia atrás. */
  move(seconds: number): void;
  getSpeed(): number;
  setSpeed(rate: number): void;
  close(): void;
};

export type FetchDoneEvent = {
  query: string;
  lang: string;
  accent: string;
  totalResult: number;
};

export type VideoChangeEvent = {
  /** ID del video de YouTube. */
  video: string;
  /** Qué número de resultado es, empezando en 1. */
  trackNumber: number;
};

export type WidgetErrorEvent = { code: number };

type WidgetOptions = {
  width?: number;
  height?: number;
  autoStart?: 0 | 1;
  /** Suma de banderas: ver `COMPONENT`. */
  components?: number;
  events?: {
    onFetchDone?: (event: FetchDoneEvent) => void;
    onVideoChange?: (event: VideoChangeEvent) => void;
    onError?: (event: WidgetErrorEvent) => void;
  };
};

type YGGlobal = {
  Widget: new (elementId: string, options: WidgetOptions) => YGWidget;
};

declare global {
  interface Window {
    YG?: YGGlobal;
    onYouglishAPIReady?: () => void;
  }
}

/**
 * Qué partes del widget se pintan. Es una suma de banderas.
 * Dejamos fuera `SEARCH` porque la app pone su propio buscador.
 */
export const COMPONENT = {
  SEARCH: 1,
  ACCENT: 2,
  TITLE: 4,
  CAPTION: 8,
  SPEED: 16,
  BUTTONS: 64,
} as const;

const API_SRC = "https://youglish.com/public/emb/widget.js";
/** Si en este tiempo no ha cargado, damos la carga por fallida. */
const API_TIMEOUT = 10000;
let apiPromise: Promise<YGGlobal> | null = null;

/**
 * Carga el script del widget una sola vez para toda la app.
 *
 * Mismo patrón que `loadYouTubeApi` en `YouTubePlayer.tsx`: sin el timeout, un
 * script que no llega deja la promesa colgada para siempre y la página se queda
 * muda y sin explicación. Aquí importa aún más, porque un bloqueador de
 * anuncios tumba este script mucho más a menudo que el de YouTube.
 */
export function loadYouglish(): Promise<YGGlobal> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YGGlobal>((resolve, reject) => {
    if (window.YG?.Widget) {
      resolve(window.YG);
      return;
    }

    const timer = setTimeout(() => {
      // Sin esto, un reintento reutilizaría la promesa ya fallida.
      apiPromise = null;
      reject(new Error("El buscador de YouGlish no cargó."));
    }, API_TIMEOUT);

    // El script llama a esta función global cuando termina de cargar.
    const previous = window.onYouglishAPIReady;
    window.onYouglishAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      resolve(window.YG as YGGlobal);
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = API_SRC;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        apiPromise = null;
        script.remove();
        reject(new Error("No se pudo descargar el script de YouGlish."));
      };
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}
