"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { CatalogItem, Status } from "@/lib/catalog";

type Filter = "todas" | Status;

/** Valor que usan los filtros de nivel y tema cuando no filtran nada. */
const ALL = "__todos__";

const BADGES: Record<Status, { label: string; className: string }> = {
  progreso: { label: "En curso", className: "bg-sky-500 text-white" },
  terminada: { label: "Terminado", className: "bg-emerald-500 text-white" },
  nueva: { label: "Sin empezar", className: "bg-black/70 text-white" },
};

/** Fila de filtros secundarios (nivel, tema): etiqueta + botones pequeños. */
function ChipRow({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </span>

      {[
        { value: ALL, label: allLabel },
        ...options.map((o) => ({ value: o, label: o })),
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={[
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-sky-600 text-white"
              : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type Props = {
  items: CatalogItem[];
  /** Sin sesión no hay progreso que filtrar. */
  isLoggedIn: boolean;
};

export default function Catalog({ items, isLoggedIn }: Props) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [level, setLevel] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");

  const levels = useMemo(
    () => [...new Set(items.flatMap((i) => i.levels))].sort(),
    [items],
  );

  const categories = useMemo(
    () =>
      [...new Set(items.flatMap((i) => i.categories))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [items],
  );

  /** Cuántos hay de cada estado, para poner el número en el botón. */
  const counts = useMemo(() => {
    const result = { todas: items.length, progreso: 0, terminada: 0, nueva: 0 };
    for (const item of items) result[item.status] += 1;
    return result;
  }, [items]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();

    return items
      .filter((item) => {
        if (filter !== "todas" && item.status !== filter) return false;
        if (level !== ALL && !item.levels.includes(level)) return false;
        if (category !== ALL && !item.categories.includes(category)) {
          return false;
        }
        if (
          search &&
          !`${item.title} ${item.description ?? ""}`
            .toLowerCase()
            .includes(search)
        ) {
          return false;
        }
        return true;
      })
      // Lo que está a medias primero: es lo que el usuario vino a seguir.
      .sort((a, b) => {
        const order = { progreso: 0, nueva: 1, terminada: 2 };
        return order[a.status] - order[b.status];
      });
  }, [category, filter, items, level, query]);

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "todas", label: "Todos", count: counts.todas },
    { value: "progreso", label: "En curso", count: counts.progreso },
    { value: "nueva", label: "Sin empezar", count: counts.nueva },
    { value: "terminada", label: "Terminados", count: counts.terminada },
  ];

  const filtering =
    filter !== "todas" || level !== ALL || category !== ALL || query !== "";

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3">
        {isLoggedIn && (
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                aria-pressed={filter === item.value}
                className={[
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === item.value
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800",
                ].join(" ")}
              >
                {item.label}
                <span className="ml-1.5 opacity-60">{item.count}</span>
              </button>
            ))}
          </div>
        )}

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar un capítulo…"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900"
        />

        <ChipRow
          label="Nivel"
          allLabel="Todos"
          options={levels}
          value={level}
          onChange={setLevel}
        />

        <ChipRow
          label="Tema"
          allLabel="Todos"
          options={categories}
          value={category}
          onChange={setCategory}
        />
      </div>

      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => {
          const badge = BADGES[item.status];

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-lg dark:border-neutral-800 dark:hover:border-sky-500"
              >
                <div className="relative aspect-video overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                  <Image
                    // hqdefault viene en 4:3 con bandas negras; al recortarlo a
                    // 16:9 las bandas desaparecen solas.
                    src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
                    {item.levels.join(" · ")}
                  </span>

                  {isLoggedIn && item.status !== "nueva" && (
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  )}

                  {/* Barra de avance pegada al borde inferior, como en YouTube. */}
                  {isLoggedIn && item.percent != null && item.percent > 0 && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                      <div
                        className="h-full bg-sky-500"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-medium leading-snug">{item.title}</h3>

                  {item.parts != null && (
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {item.parts} partes
                      {isLoggedIn && item.partsDone > 0 && (
                        <> · {item.partsDone} terminadas</>
                      )}
                    </p>
                  )}

                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
                      {item.description}
                    </p>
                  )}

                  {item.categories.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1">
                      {item.categories.map((name) => (
                        <li
                          key={name}
                          className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}

                  {isLoggedIn && item.hint && (
                    <p className="mt-auto pt-3 text-xs font-medium text-sky-700 dark:text-sky-400">
                      ▸ {item.hint}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {items.length === 0
              ? "Todavía no hay capítulos."
              : "Nada coincide con el filtro."}
          </p>

          {filtering && items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilter("todas");
                setLevel(ALL);
                setCategory(ALL);
                setQuery("");
              }}
              className="mt-2 text-sm font-medium text-sky-600 underline dark:text-sky-400"
            >
              Quitar los filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
