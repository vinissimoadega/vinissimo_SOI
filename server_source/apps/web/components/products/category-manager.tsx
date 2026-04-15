"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductCategory } from "@/types";
import { clientApiRequest } from "@/lib/client-api";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";

export function CategoryManager({
  categories,
}: {
  categories: ProductCategory[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      await clientApiRequest("/categories", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug: slug || null,
          isActive: true,
        }),
      });

      setName("");
      setSlug("");
      setMessage("Categoria criada e pronta para uso nos produtos.");
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível criar a categoria.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <SectionCard
      title="Categorias"
      subtitle="Curadoria mínima do mix para organizar o cadastro sem virar catálogo genérico."
    >
      <div className="space-y-5">
        <div className="space-y-3">
          {categories.length === 0 ? (
            <p className="text-sm text-black/55">
              Nenhuma categoria criada ainda. Use o formulário abaixo para começar.
            </p>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-black/5 bg-vinho-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-grafite">{category.name}</p>
                  <p className="text-xs text-black/45">
                    slug: {category.slug} · {category.productCount} produto(s)
                  </p>
                </div>
                <StatusBadge
                  label={category.isActive ? "Ativa" : "Inativa"}
                  tone={category.isActive ? "success" : "inativo"}
                />
              </div>
            ))
          )}
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3">
            <input
              className="input-soft"
              placeholder="Nome da categoria"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              className="input-soft"
              placeholder="Slug opcional (ex.: tintos-premium)"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>

          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <button className="btn-primary w-full" disabled={isPending} type="submit">
            {isPending ? "Criando..." : "Criar categoria"}
          </button>
        </form>
      </div>
    </SectionCard>
  );
}
