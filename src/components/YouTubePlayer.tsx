"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Subconjunto de la API del reproductor de YouTube que usamos. */
export type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};

/** Estados que devuelve `getPlayerState()`. */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

type YTGlobal = {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayer }) => void;
        onStateChange?: (event: { data: number; target: YTPlayer }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";
/** Si en este tiempo la API no ha cargado, damos la carga por fallida. */
const API_TIMEOUT = 10000;
let apiPromise: Promise<YTGlobal> | null = null;

/**
 * Carga el script de la IFrame API una sola vez para toda la app.
 *
 * Si no carga (un bloqueador, la red, YouTube caído) hay que enterarse: sin
 * esto la promesa se quedaba pendiente para siempre y la lección se quedaba
 * muda y sin explicación, con todos los botones sin hacer nada.
 */
function loadYouTubeApi(): Promise<YTGlobal> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTGlobal>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const timer = setTimeout(() => {
      // Sin esto, un reintento reutilizaría la promesa ya fallida.
      apiPromise = null;
      reject(new Error("La API de YouTube no cargó."));
    }, API_TIMEOUT);

    // La API llama a esta función global cuando termina de cargar.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      resolve(window.YT as YTGlobal);
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = API_SRC;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        apiPromise = null;
        script.remove();
        reject(new Error("No se pudo descargar el script de YouTube."));
      };
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}

type Props = {
  videoId: string;
  /** Segundo en el que arranca el video (para lecciones que son un trozo). */
  start?: number;
  /** Se llama una vez cuando el reproductor está listo. */
  onReady?: (player: YTPlayer) => void;
  /** Se llama ~4 veces por segundo mientras el video avanza. */
  onTime?: (seconds: number) => void;
  /** Se llama cuando cambia el estado (reproduciendo, pausado, terminado...). */
  onStateChange?: (state: number) => void;
  /**
   * Qué hacer cuando el usuario pulsa el play de la pantalla de pausa. Si no se
   * pasa, se reanuda sin más. La lección lo usa para no arrancar pasado el
   * final del tramo.
   */
  onRequestPlay?: () => void;
};

export default function YouTubePlayer({
  videoId,
  start = 0,
  onReady,
  onTime,
  onStateChange,
  onRequestPlay,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const domId = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const [state, setState] = useState<number>(YT_STATE.UNSTARTED);
  /** Mensaje de por qué no hay reproductor, si es que no lo hay. */
  const [failed, setFailed] = useState("");
  /** Se cambia para volver a intentar la carga. */
  const [attempt, setAttempt] = useState(0);

  // Guardamos los callbacks en refs para no recrear el reproductor cuando cambian.
  const onReadyRef = useRef(onReady);
  const onTimeRef = useRef(onTime);
  const onStateChangeRef = useRef(onStateChange);
  onReadyRef.current = onReady;
  onTimeRef.current = onTime;
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    let player: YTPlayer | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;

      // El constructor reemplaza el nodo, por eso montamos un hijo desechable.
      const mount = document.createElement("div");
      mount.id = `yt-${domId}`;
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(mount);

      player = new YT.Player(mount, {
        videoId,
        playerVars: {
          // Sin controles de YouTube: cada `seekTo` del bucle los hacía
          // reaparecer. Play/pausa y navegación los lleva la propia app.
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: Math.floor(start),
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            playerRef.current = event.target;
            onReadyRef.current?.(event.target);
            interval = setInterval(() => {
              onTimeRef.current?.(event.target.getCurrentTime());
            }, 200);
          },
          onStateChange: (event) => {
            setState(event.data);
            onStateChangeRef.current?.(event.data);
          },
        },
      });
    }).catch((error: Error) => {
      if (cancelled) return;
      setFailed(error.message);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      player?.destroy();
    };
  }, [videoId, domId, attempt]);

  // Al pausar, YouTube saca su propia pantalla con "More videos" y la miniatura
  // de otros videos. No hay forma de apagarla desde la API, así que la tapamos.
  // Ojo: BUFFERING queda fuera a propósito, si no parpadearía en cada vuelta
  // del bucle (cada `seekTo` pasa por ese estado).
  const covered =
    state === YT_STATE.PAUSED ||
    state === YT_STATE.ENDED ||
    state === YT_STATE.UNSTARTED ||
    state === YT_STATE.CUED;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <div ref={containerRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />

      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900 p-6 text-center text-sm text-white">
          <p>
            No se pudo cargar el reproductor de YouTube.
            <br />
            <span className="text-neutral-400">{failed}</span>
          </p>
          <p className="text-xs text-neutral-400">
            Suele ser un bloqueador de anuncios, una extensión o la red.
          </p>
          <button
            type="button"
            onClick={() => {
              setFailed("");
              setAttempt((n) => n + 1);
            }}
            className="rounded-lg bg-white px-3 py-1.5 font-medium text-neutral-900 hover:bg-neutral-200"
          >
            Reintentar
          </button>
        </div>
      ) : (
        covered && (
        <button
          type="button"
          onClick={() => {
            if (onRequestPlay) onRequestPlay();
            else playerRef.current?.playVideo();
          }}
          aria-label="Reproducir"
          className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-white transition-colors hover:bg-neutral-800"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/60 pl-1 text-2xl">
            ▶
          </span>
          </button>
        )
      )}
    </div>
  );
}
