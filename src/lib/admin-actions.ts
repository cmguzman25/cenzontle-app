"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions";
import { createAdminClient, isAdminEmail } from "@/lib/admin";
import { translateAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/server";

const MIN_PASSWORD = 6;

/**
 * Las Server Actions son endpoints públicos: cualquiera puede llamarlas aunque
 * la página no se le muestre. Por eso el permiso se comprueba aquí otra vez.
 */
async function denyIfNotAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "No has iniciado sesión.";
  if (!isAdminEmail(user.email)) return "No tienes permiso para esto.";
  return null;
}

/**
 * Crea una cuenta ya activa. Como las cuentas las das tú a mano, no hace falta
 * que la persona confirme nada por correo: entra con su contraseña y ya está.
 */
export async function createUser(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const denied = await denyIfNotAdmin();
  if (denied) return { ok: false, error: denied };

  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Escribe un correo." };
  if (input.password.length < MIN_PASSWORD) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`,
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Falta SUPABASE_SECRET_KEY en el archivo .env." };
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    // La clave del asunto: sin esto la cuenta nace sin confirmar y Supabase
    // pide abrir un enlace del correo antes de dejar entrar.
    email_confirm: true,
  });

  if (error) return { ok: false, error: translateAuthError(error.message) };

  revalidatePath("/admin");
  return { ok: true };
}
