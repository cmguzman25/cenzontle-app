"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ErrorBox,
  Field,
  PasswordField,
  SubmitButton,
} from "@/components/AuthForm";
import { translateAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 6;

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== repeat) {
      setError("Las dos contraseñas no son iguales.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });

    if (error) {
      setError(translateAuthError(error.message));
      setLoading(false);
      return;
    }

    // Supabase no dice abiertamente si un correo ya existe (para no filtrar
    // quién está registrado): devuelve un usuario sin identidades.
    if (data.user && data.user.identities?.length === 0) {
      setError(
        "Ya existe una cuenta con ese correo. Entra en lugar de registrarte.",
      );
      setLoading(false);
      return;
    }

    if (data.session) {
      // El proyecto no exige confirmar el correo: ya estamos dentro.
      router.refresh();
      router.push("/");
      return;
    }

    setCheckEmail(true);
    setLoading(false);
  }

  if (checkEmail) {
    return (
      <main className="mx-auto max-w-sm px-4 py-12">
        <h1 className="text-2xl font-semibold">Revisa tu correo</h1>
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-700 dark:bg-emerald-950/40">
          Enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo
          para activar tu cuenta.
        </div>
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Si no lo ves, mira en la carpeta de spam.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-sky-600 underline"
        >
          Ir a entrar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
      >
        ← Volver
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Crear cuenta</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Con una cuenta se guardan tus palabras y tus resultados.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Field
          label="Correo"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          autoComplete="email"
        />

        <PasswordField
          label="Contraseña"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          hint={`Mínimo ${MIN_PASSWORD} caracteres.`}
        />

        <PasswordField
          label="Repite la contraseña"
          required
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          autoComplete="new-password"
        />

        {error && <ErrorBox>{error}</ErrorBox>}

        <SubmitButton loading={loading}>Crear cuenta</SubmitButton>
      </form>

      <p className="mt-8 border-t border-neutral-200 pt-4 text-center text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-sky-600 underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
