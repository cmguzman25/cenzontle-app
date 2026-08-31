"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import {
  ErrorBox,
  Field,
  PasswordField,
  SubmitButton,
} from "@/components/AuthForm";
import { translateAuthError } from "@/lib/auth-errors";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "magic";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  /** A dónde volver: lo pone la página que nos mandó aquí. */
  const next = safeNext(useSearchParams().get("next"));
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(translateAuthError(error.message));
      setLoading(false);
      return;
    }

    // `refresh` hace que el servidor vuelva a leer la sesión de las cookies.
    router.refresh();
    router.push(next);
  }

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });

    setLoading(false);
    if (error) setError(translateAuthError(error.message));
    else setMagicSent(true);
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
      >
        ← Volver
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Entrar</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Tus palabras guardadas y tu progreso quedan en tu cuenta.
      </p>

      {magicSent ? (
        <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-700 dark:bg-emerald-950/40">
          Listo. Revisa <strong>{email}</strong> y abre el enlace para entrar.
        </div>
      ) : (
        <>
          <form
            onSubmit={mode === "password" ? signInWithPassword : sendMagicLink}
            className="mt-6 flex flex-col gap-4"
          >
            <Field
              label="Correo"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
            />

            {mode === "password" && (
              <PasswordField
                label="Contraseña"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            )}

            {error && <ErrorBox>{error}</ErrorBox>}

            <SubmitButton loading={loading}>
              {mode === "password" ? "Entrar" : "Enviar enlace"}
            </SubmitButton>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "password" ? "magic" : "password");
              setError("");
            }}
            className="mt-4 w-full text-center text-sm text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            {mode === "password"
              ? "Prefiero entrar con un enlace por correo"
              : "Prefiero entrar con contraseña"}
          </button>
        </>
      )}

      <p className="mt-8 border-t border-neutral-200 pt-4 text-center text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        ¿Todavía no tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-sky-600 underline">
          Crear cuenta
        </Link>
      </p>
    </main>
  );
}
