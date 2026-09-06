import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Quién puede crear cuentas. Se lee de `ADMIN_EMAILS` en `.env`, separados por
 * comas. No está en `next.config.ts`, así que nunca viaja al navegador.
 */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = adminEmails();
  // Sin lista no hay administradores. Es a propósito: si alguien despliega sin
  // configurar la variable, mejor que no entre nadie a que entre cualquiera.
  if (allowed.length === 0) return false;
  return allowed.includes(email.toLowerCase());
}

/**
 * Cliente con la clave secreta de Supabase. Se salta las políticas RLS y puede
 * tocar `auth.users`, así que **solo** se usa en el servidor y **solo** después
 * de comprobar `isAdminEmail`.
 *
 * Devuelve `null` si falta la clave, para poder avisar en pantalla en lugar de
 * reventar con un error 500.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;

  return createSupabaseClient(process.env.SUPABASE_URL!, secret, {
    // Este cliente no es de nadie: no hay sesión que guardar ni que refrescar.
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
