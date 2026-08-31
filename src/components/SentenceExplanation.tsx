"use client";

import type { Sentence } from "@/lib/types";

type Props = {
  sentence: Sentence;
  /** Si el español ya se ve en la lista, no lo repetimos aquí. */
  showEs: boolean;
  savedWords: Set<string>;
  onSaveWord: (word: string, meaning: string, sentence: Sentence) => void;
};

/** ¿Esta frase tiene algo que explicar? Si no, no pintamos el botón. */
export function hasExplanation(sentence: Sentence): boolean {
  return Boolean(
    sentence.note ||
      sentence.tip ||
      sentence.watch ||
      (sentence.vocab && sentence.vocab.length > 0),
  );
}

function Block({
  icon,
  title,
  tone,
  children,
}: {
  icon: string;
  title: string;
  tone: "neutral" | "sky" | "amber";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-neutral-100 dark:bg-neutral-900",
    sky: "bg-sky-50 dark:bg-sky-950/40",
    amber: "bg-amber-50 dark:bg-amber-500/10",
  } as const;

  return (
    <div className={`mt-2 rounded-lg p-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {icon} {title}
      </p>
      <p className="mt-1 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

/**
 * Explicación de UNA frase, pensada para ir justo debajo de ella dentro de la
 * transcripción. Así en el móvil no hay que subir a buscarla.
 */
export default function SentenceExplanation({
  sentence,
  showEs,
  savedWords,
  onSaveWord,
}: Props) {
  return (
    <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
      {/* Si el español está oculto en la lista, aquí sí lo mostramos: abrir la
          explicación ya es pedir ayuda a propósito. */}
      {!showEs && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {sentence.es}
        </p>
      )}

      {sentence.note && (
        <Block icon="🧩" title="Cómo funciona" tone="neutral">
          {sentence.note}
        </Block>
      )}

      {sentence.tip && (
        <Block icon="💬" title="Cuándo se usa" tone="sky">
          {sentence.tip}
        </Block>
      )}

      {sentence.watch && (
        <Block icon="⚠️" title="Ojo" tone="amber">
          {sentence.watch}
        </Block>
      )}

      {sentence.vocab && sentence.vocab.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Vocabulario
          </h3>
          <ul className="mt-1 flex flex-col gap-2">
            {sentence.vocab.map((item) => {
              const saved = savedWords.has(item.word.toLowerCase());
              return (
                <li
                  key={item.word}
                  className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-2 text-sm last:border-0 dark:border-neutral-800"
                >
                  <div className="min-w-0">
                    <p>
                      <strong>{item.word}</strong>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {" "}
                        — {item.meaning}
                      </span>
                    </p>
                    {item.example && (
                      <p className="mt-0.5 text-xs italic text-neutral-500 dark:text-neutral-400">
                        “{item.example}”
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={saved}
                    onClick={() => onSaveWord(item.word, item.meaning, sentence)}
                    className="mt-0.5 shrink-0 rounded-md border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    {saved ? "Guardada" : "Guardar"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
