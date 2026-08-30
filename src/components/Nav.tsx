import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export default async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold">
          Frase a Frase
        </Link>

        <Link
          href="/words"
          className="text-neutral-600 hover:underline dark:text-neutral-400"
        >
          Mis palabras
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-neutral-500 sm:inline dark:text-neutral-400">
                {user.email}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Salir
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-sky-600 px-3 py-1.5 font-medium text-white hover:bg-sky-700"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
