"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (!response.ok) {
      setErrorMessage(payload?.message || "Não foi possível autenticar.");
      return;
    }

    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-grafite" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className="input-soft w-full"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@vinissimo.com.br"
          required
          type="email"
          value={email}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-grafite" htmlFor="password">
          Senha
        </label>
        <input
          autoComplete="current-password"
          className="input-soft w-full"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Digite sua senha"
          required
          type="password"
          value={password}
        />
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <button className="btn-primary w-full justify-center" disabled={isPending}>
        {isPending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
