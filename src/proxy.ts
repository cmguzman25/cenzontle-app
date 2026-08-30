import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

/**
 * En Next.js 16 este archivo reemplaza a `middleware.ts`.
 * Se ejecuta antes de cada petición para mantener viva la sesión de Supabase.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todas las rutas menos archivos estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
