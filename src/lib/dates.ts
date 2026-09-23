/**
 * Milisegundos de una fecha de Postgres, o `NaN` si no hay forma.
 *
 * Postgres puede mandarla como `2026-09-23T10:00:00+00:00` o con un espacio
 * en medio en vez de la T. Chrome se traga las dos, pero Safari (el iPhone)
 * devuelve `NaN` con la del espacio, y entonces el orden del repaso saldría
 * mal sin que nadie se entere.
 */
export function parseDate(value: string): number {
  const direct = new Date(value).getTime();
  if (!Number.isNaN(direct)) return direct;
  return new Date(value.replace(" ", "T")).getTime();
}

/**
 * Cuánto hace de una fecha, en castellano y sin precisión de más: para decidir
 * qué repasar, "hace tres semanas" dice lo mismo que el día exacto y se lee de
 * un vistazo.
 */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = parseDate(iso);
  if (Number.isNaN(then)) return "";

  const days = Math.floor((now - then) / 86_400_000);

  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;

  const weeks = Math.floor(days / 7);
  if (days < 31) return weeks === 1 ? "hace 1 semana" : `hace ${weeks} semanas`;

  const months = Math.floor(days / 30);
  if (days < 365) return months === 1 ? "hace 1 mes" : `hace ${months} meses`;

  const years = Math.floor(days / 365);
  return years === 1 ? "hace 1 año" : `hace ${years} años`;
}
