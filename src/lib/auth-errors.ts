/**
 * Supabase devuelve sus errores en inglés. Aquí los pasamos a español
 * para que el mensaje que ve el usuario se entienda.
 */
const TRANSLATIONS: [RegExp, string][] = [
  [
    /invalid login credentials/i,
    "El correo o la contraseña no son correctos.",
  ],
  [
    /email not confirmed/i,
    "Todavía no has confirmado tu correo. Abre el enlace que te enviamos.",
  ],
  [
    /user already registered|already been registered/i,
    "Ya existe una cuenta con ese correo. Entra en lugar de registrarte.",
  ],
  [
    /password should be at least (\d+)/i,
    "La contraseña es muy corta: debe tener al menos 6 caracteres.",
  ],
  [
    /signup requires a valid password/i,
    "Escribe una contraseña válida.",
  ],
  [
    /unable to validate email address|invalid format/i,
    "Ese correo no parece válido.",
  ],
  [
    /for security purposes.*after (\d+) seconds/i,
    "Espera unos segundos antes de volver a intentarlo.",
  ],
  [
    /email rate limit exceeded|over_email_send_rate_limit/i,
    "Se enviaron demasiados correos. Espera unos minutos.",
  ],
  [
    /same password/i,
    "La contraseña nueva debe ser distinta de la anterior.",
  ],
  [
    /failed to fetch|network/i,
    "No hay conexión con el servidor. Revisa tu internet.",
  ],
];

export function translateAuthError(message: string): string {
  for (const [pattern, spanish] of TRANSLATIONS) {
    if (pattern.test(message)) return spanish;
  }
  // Si no lo conocemos, mostramos el original para no ocultar información.
  return message;
}
