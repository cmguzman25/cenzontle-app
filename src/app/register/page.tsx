import Link from "next/link";

export const metadata = { title: "Registro cerrado" };

/**
 * El registro público está cerrado: las cuentas las crea el administrador desde
 * `/admin`. Esta página se queda para que quien llegue aquí desde un enlace
 * viejo o un marcador entienda qué pasa, en vez de encontrarse un 404.
 *
 * Ojo: esto es solo la pantalla. El cierre de verdad está en el panel de
 * Supabase (Authentication → Sign In / Providers → Allow new users to sign up,
 * apagado), porque sin eso se puede llamar a la API de registro directamente.
 */
export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
      >
        ← Volver
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">El registro está cerrado</h1>

      <p className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        Esta app no crea cuentas sola. Si quieres una, pídesela al
        administrador y te la prepara en un momento.
      </p>

      <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-sky-600 underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
