"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { clientApiRequest } from "@/lib/client-api";

type SupplierItem = {
  id: string;
  supplierCode: string | null;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type SupplierListResponse = {
  items: SupplierItem[];
  filters: {
    search: string | null;
    isActive: boolean | null;
  };
};

type SupplierFormState = {
  id: string | null;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  leadTimeDays: string;
  isActive: boolean;
  notes: string;
};

const EMPTY_FORM: SupplierFormState = {
  id: null,
  name: "",
  contactName: "",
  phone: "",
  email: "",
  leadTimeDays: "",
  isActive: true,
  notes: "",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSuppliers() {
    setIsLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (search.trim()) {
        query.set("search", search.trim());
      }
      if (statusFilter === "active") {
        query.set("is_active", "true");
      }
      if (statusFilter === "inactive") {
        query.set("is_active", "false");
      }

      const response = await clientApiRequest<SupplierListResponse>(
        `/suppliers${query.toString() ? `?${query.toString()}` : ""}`,
      );
      setSuppliers(response.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar os fornecedores.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSuppliers();
  }, []);

  function loadSupplierIntoForm(supplier: SupplierItem) {
    setForm({
      id: supplier.id,
      name: supplier.name,
      contactName: supplier.contactName ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      leadTimeDays:
        supplier.leadTimeDays === null ? "" : String(supplier.leadTimeDays),
      isActive: supplier.isActive,
      notes: supplier.notes ?? "",
    });
    setMessage(`Fornecedor ${supplier.name} carregado para edição.`);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = {
        name: form.name,
        contactName: form.contactName || null,
        phone: form.phone || null,
        email: form.email || null,
        leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : null,
        isActive: form.isActive,
        notes: form.notes || null,
      };

      if (form.id) {
        await clientApiRequest<SupplierItem>(`/suppliers/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("Fornecedor atualizado com sucesso.");
      } else {
        await clientApiRequest<SupplierItem>("/suppliers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Fornecedor cadastrado com sucesso.");
      }

      setForm(EMPTY_FORM);
      await loadSuppliers();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível salvar o fornecedor.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Fornecedores</h1>
          <p className="mt-2 text-sm text-black/55">
            Cadastro operacional de fornecedores reais, com lead time, contato e
            status ativo/inativo para uso no fluxo de compras.
          </p>
        </div>
      </header>

      <SectionCard
        title="Cadastro e edição"
        subtitle="Mantenha aqui apenas fornecedores reais utilizados pela operação."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="input-soft"
              placeholder="Nome do fornecedor"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
            <input
              className="input-soft"
              placeholder="Contato"
              value={form.contactName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contactName: event.target.value,
                }))
              }
            />
            <input
              className="input-soft"
              placeholder="Telefone"
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
            <input
              className="input-soft"
              placeholder="Email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
            <input
              className="input-soft"
              inputMode="numeric"
              placeholder="Lead time em dias"
              value={form.leadTimeDays}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  leadTimeDays: event.target.value,
                }))
              }
            />
            <select
              className="input-soft"
              value={form.isActive ? "active" : "inactive"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isActive: event.target.value === "active",
                }))
              }
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
            <textarea
              className="input-soft min-h-28 w-full resize-y md:col-span-2"
              placeholder="Observações do fornecedor"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="btn-primary w-full sm:w-auto" disabled={isSaving} type="submit">
                {isSaving
                  ? "Salvando..."
                  : form.id
                    ? "Atualizar fornecedor"
                    : "Cadastrar fornecedor"}
              </button>
              <button
                className="btn-secondary w-full sm:w-auto"
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
              >
                Limpar formulário
              </button>
            </div>
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Leitura operacional"
        subtitle="Use esta área para localizar fornecedores e abrir a edição sem sair da tela."
      >
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
          <input
            className="input-soft"
            placeholder="Buscar por nome, contato, telefone ou email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="input-soft"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <button className="btn-secondary w-full md:w-auto" type="button" onClick={() => void loadSuppliers()}>
            Atualizar lista
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {isLoading ? (
            <p className="text-sm text-black/55">Carregando fornecedores...</p>
          ) : suppliers.length === 0 ? (
            <p className="text-sm text-black/55">
              Nenhum fornecedor encontrado com os filtros atuais.
            </p>
          ) : (
            suppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="rounded-2xl border border-black/10 bg-black/[0.02] p-4"
              >
                <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-vinho-950">
                        {supplier.name}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                          supplier.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-black/10 text-black/60"
                        }`}
                      >
                        {supplier.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-black/60">
                      {supplier.contactName ?? "Sem contato"} ·{" "}
                      {supplier.phone ?? "Sem telefone"} ·{" "}
                      {supplier.email ?? "Sem email"}
                    </p>
                    <p className="mt-1 text-sm text-black/60">
                      Lead time:{" "}
                      {supplier.leadTimeDays === null
                        ? "Não informado"
                        : `${supplier.leadTimeDays} dia(s)`}
                    </p>
                    {supplier.notes ? (
                      <p className="mt-2 text-sm text-black/60">{supplier.notes}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-black/40">
                      Atualizado em {formatDateTime(supplier.updatedAt)}
                    </p>
                  </div>
                  <button
                    className="btn-secondary w-full sm:w-auto"
                    type="button"
                    onClick={() => loadSupplierIntoForm(supplier)}
                  >
                    Editar fornecedor
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
