"use client";

import { useState } from "react";

import { ErrorBox, Field, PasswordField, SubmitButton } from "@/components/AuthForm";
import { createUser } from "@/lib/admin-actions";

const MIN_PASSWORD = 6;

/** Alta manual de una cuenta. Solo se monta dentro de `/admin`. */
export default function NewUserForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setCreated("");

    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }

    setLoading(true);
    const result = await createUser({ email, password });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCreated(email.trim().toLowerCase());
    setEmail("");
    setPassword("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
      <Field
        label="Correo"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="persona@correo.com"
        autoComplete="off"
      />

      <PasswordField
        label="Contraseña"
        required
        minLength={MIN_PASSWORD}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        hint="Mínimo 6 caracteres. Pásasela tú y que la cambie luego si quiere."
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      {created && (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-700 dark:bg-emerald-950/40">
          Cuenta creada para <strong>{created}</strong>. Ya puede entrar en{" "}
          <span className="font-mono text-xs">/login</span> sin confirmar nada.
        </p>
      )}

      <SubmitButton loading={loading}>Crear cuenta</SubmitButton>
    </form>
  );
}
