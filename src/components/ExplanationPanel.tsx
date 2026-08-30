"use client";

import { useMemo } from "react";

import HighlightedText, {
  buildHighlightPattern,
} from "@/components/HighlightedText";
import type { Sentence } from "@/lib/types";

type Props = {
  sentence: Sentence | null;
  savedWords: Set<string>;
  onSaveWord: (word: string, meaning: string, sentence: Sentence) => void;
};

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
    <div className={`mt-3 rounded-lg p-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {icon} {title}
      </p>
      <p className="mt-1 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

export default function ExplanationPanel({
  sentence,
  savedWords,
  onSaveWord,
}: Props) {
  const highlight = useMemo(
    () => buildHighlightPattern(savedWords),
    [savedWords],
  );

  if (!sentence) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        Dale play o haz clic en una frase para ver su explicación.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Explicación
      </h2>

      <p className="mt-2 text-base font-medium">
        <HighlightedText text={sentence.en} pattern={highlight} />
      </p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {sentence.es}
      </p>

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
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Vocabulario
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
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
