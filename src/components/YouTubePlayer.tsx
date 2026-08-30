"use client";

import { useEffect, useId, useRef } from "react";

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
let apiPromise: Promise<YTGlobal> | null = null;

/** Carga el script de la IFrame API una sola vez para toda la app. */
function loadYouTubeApi(): Promise<YTGlobal> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTGlobal>((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    // La API llama a esta función global cuando termina de cargar.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT as YTGlobal);
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = API_SRC;
      script.async = true;
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
};

export default function YouTubePlayer({
  videoId,
  start = 0,
  onReady,
  onTime,
  onStateChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const domId = useId().replace(/[^a-zA-Z0-9-]/g, "");

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
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: Math.floor(start),
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            onReadyRef.current?.(event.target);
            interval = setInterval(() => {
              onTimeRef.current?.(event.target.getCurrentTime());
            }, 200);
          },
          onStateChange: (event) => {
            onStateChangeRef.current?.(event.data);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      player?.destroy();
    };
  }, [videoId, domId]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <div ref={containerRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
    </div>
  );
}
