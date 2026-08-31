/**
 * Limpia el `?next=` al que volvemos después de iniciar sesión.
 *
 * Solo dejamos pasar rutas internas. Sin esto, un enlace con
 * `?next=https://sitio-falso.com` sacaría al usuario de la app justo después
 * de escribir su contraseña, que es el momento en el que menos mira la barra
 * de direcciones.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  // `//otro-dominio.com` también sale fuera, aunque empiece por barra.
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
