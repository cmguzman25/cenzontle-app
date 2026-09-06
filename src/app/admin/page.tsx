import Link from "next/link";
import { notFound } from "next/navigation";

import NewUserForm from "@/components/NewUserForm";
import { createAdminClient, isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Usuarios" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 404 y no "no tienes permiso": así ni se sabe que esta página existe.
  if (!isAdminEmail(user?.email)) notFound();

  const admin = createAdminClient();
  const { data } = admin
    ? await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    : { data: null };
  const users = data?.users ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
      >
        ← Volver
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Usuarios</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        El registro público está cerrado: las cuentas se crean desde aquí.
      </p>

      {admin ? (
        <NewUserForm />
      ) : (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-600 dark:bg-amber-950/40">
          Falta <span className="font-mono text-xs">SUPABASE_SECRET_KEY</span> en
          el archivo <span className="font-mono text-xs">.env</span>. Sin ella no
          se pueden crear cuentas desde la app.
        </p>
      )}

      <h2 className="mt-10 text-lg font-semibold">
        Cuentas que ya existen ({users.length})
      </h2>

      <ul className="mt-3 divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
        {users.map((account) => (
          <li
            key={account.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2"
          >
            <span className="font-medium">{account.email}</span>
            {!account.email_confirmed_at && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                sin confirmar
              </span>
            )}
            <span className="ml-auto text-xs text-neutral-500 dark:text-neutral-400">
              {account.last_sign_in_at
                ? `entró el ${formatDate(account.last_sign_in_at)}`
                : "nunca ha entrado"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-8 border-t border-neutral-200 pt-4 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        Para borrar una cuenta, usa el panel de Supabase → Authentication →
        Users.
      </p>
    </main>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
