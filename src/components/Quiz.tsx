"use client";

import { useState } from "react";

import type { QuizItem } from "@/lib/types";

export type QuizResult = { percent: number; correct: number; total: number };

type Props = {
  items: QuizItem[];
  onFinish?: (result: QuizResult) => void;
};

function feedback(percent: number): string {
  if (percent >= 90) return "¡Excelente! Este video está a tu nivel.";
  if (percent >= 70) return "Muy bien. Este es el nivel ideal de input comprensible.";
  if (percent >= 50) return "Vas bien. Repite el video con la traducción visible.";
  return "Este video todavía es difícil. Prueba uno más sencillo.";
}

export default function Quiz({ items, onFinish }: Props) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const correct = items.filter((item, i) => answers[i] === item.answer).length;
  const percent = items.length ? Math.round((correct / items.length) * 100) : 0;
  const allAnswered = items.every((_, i) => answers[i] !== undefined);

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">¿Cuánto entendiste?</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Responde sin volver a mirar la transcripción.
      </p>

      <ol className="mt-4 flex flex-col gap-5">
        {items.map((item, i) => (
          <li key={i}>
            <p className="font-medium">
              {i + 1}. {item.q}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {item.options.map((option, j) => {
                const chosen = answers[i] === j;
                const isRight = item.answer === j;
                const state = submitted
                  ? isRight
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                    : chosen
                      ? "border-red-400 bg-red-50 dark:bg-red-950/40"
                      : "border-transparent"
                  : chosen
                    ? "border-sky-400 bg-sky-50 dark:bg-sky-950/40"
                    : "border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-900";

                return (
                  <label
                    key={j}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${state}`}
                  >
                    <input
                      type="radio"
                      name={`q-${i}`}
                      checked={chosen}
                      disabled={submitted}
                      onChange={() => setAnswers((a) => ({ ...a, [i]: j }))}
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {!submitted ? (
        <button
          type="button"
          disabled={!allAnswered}
          onClick={() => {
            setSubmitted(true);
            onFinish?.({ percent, correct, total: items.length });
          }}
          className="mt-5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-40"
        >
          Ver resultado
        </button>
      ) : (
        <div className="mt-5 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-900">
          <p className="text-2xl font-semibold">{percent}% entendido</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {correct} de {items.length} correctas. {feedback(percent)}
          </p>
          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
            className="mt-3 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}
