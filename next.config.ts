import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Estas dos son públicas (la publishable key está pensada para el navegador).
  // Declararlas aquí las incrusta en el bundle del cliente en tiempo de build,
  // que es lo que haría el prefijo NEXT_PUBLIC_ si lo llevaran en el nombre.
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY!,
  },
};

export default nextConfig;
