"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductCategory, ProductListItem } from "@/types";
import { ApiRequestError, clientApiRequest } from "@/lib/client-api";
import { lookupProductBySku, normalizeSkuValue } from "@/lib/product-sku-lookup";
import { BarcodeScannerSheet } from "@/components/scanner/barcode-scanner-sheet";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";

type ProductFormProps = {
  mode: "create" | "edit";
  categories: ProductCategory[];
  product?: ProductListItem;
  initialSku?: string | null;
};

export function ProductForm({
  mode,
  categories,
  product,
  initialSku,
}: ProductFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    sku: product?.sku ?? initialSku ?? "",
    name: product?.name ?? "",
    categoryId: product?.categoryId ?? "",
    countryName: product?.countryName ?? "",
    regionName: product?.regionName ?? "",
    grapeComposition: product?.grapeComposition ?? "",
    wineDescription: product?.wineDescription ?? "",
    baseUnitCost: product?.baseUnitCost ?? "",
    initialStockQty: product?.initialStockQty ?? "0.00",
    minStockManualQty: product?.minStockManualQty ?? "",
    notes: product?.notes ?? "",
    isActive: product?.isActive ?? true,
  });
  const [duplicateProduct, setDuplicateProduct] = useState<{
    href: string;
    name: string;
    sku: string;
    isActive: boolean | null;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  function updateField<Field extends keyof typeof form>(
    field: Field,
    value: (typeof form)[Field],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearDuplicateProductHint() {
    setDuplicateProduct(null);
  }

  async function handleDetectedSku(sku: string) {
    const normalizedSku = normalizeSkuValue(sku);

    clearDuplicateProductHint();
    setError(null);
    setMessage(null);
    updateField("sku", normalizedSku);

    const lookup = await lookupProductBySku(normalizedSku);

    if (!lookup.found || !lookup.product) {
      setMessage("SKU lido com sucesso. Continue o cadastro do vinho.");
      return;
    }

    const isCurrentProduct = mode === "edit" && lookup.product.id === product?.id;

    if (isCurrentProduct) {
      setMessage("SKU lido com sucesso e confirmado para este cadastro.");
      return;
    }

    setDuplicateProduct({
      href: `/products/${lookup.product.id}`,
      name: lookup.product.name,
      sku: lookup.product.sku,
      isActive: lookup.product.isActive,
    });
    setMessage("Este SKU já está cadastrado. Abra o produto existente para editar ou conferir o estoque.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setError(null);
    setDuplicateProduct(null);

    const payload = {
      sku: form.sku,
      name: form.name,
      categoryId: form.categoryId || null,
      countryName: form.countryName || null,
      regionName: form.regionName || null,
      grapeComposition: form.grapeComposition || null,
      wineDescription: form.wineDescription || null,
      baseUnitCost: form.baseUnitCost || null,
      initialStockQty: form.initialStockQty || null,
      minStockManualQty: form.minStockManualQty || null,
      notes: form.notes || null,
      isActive: form.isActive,
    };

    try {
      if (mode === "create") {
        const created = await clientApiRequest<ProductListItem>("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        router.push(`/products/${created.id}`);
        return;
      }

      const updated = await clientApiRequest<ProductListItem>(
        `/products/${product?.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );

      setForm({
        sku: updated.sku,
        name: updated.name,
        categoryId: updated.categoryId ?? "",
        countryName: updated.countryName ?? "",
        regionName: updated.regionName ?? "",
        grapeComposition: updated.grapeComposition ?? "",
        wineDescription: updated.wineDescription ?? "",
        baseUnitCost: updated.baseUnitCost ?? "",
        initialStockQty: updated.initialStockQty,
        minStockManualQty: updated.minStockManualQty ?? "",
        notes: updated.notes ?? "",
        isActive: updated.isActive,
      });
      setMessage("Produto atualizado com sucesso.");
      startTransition(() => router.refresh());
    } catch (submissionError) {
      if (submissionError instanceof ApiRequestError) {
        const payload = submissionError.payload;

        if (payload && typeof payload === "object") {
          const details = payload as {
            existingProductHref?: string;
            existingProductName?: string;
            existingProductSku?: string;
            existingProductIsActive?: boolean;
          };

          if (
            typeof details.existingProductHref === "string" &&
            typeof details.existingProductName === "string" &&
            typeof details.existingProductSku === "string"
          ) {
            setDuplicateProduct({
              href: details.existingProductHref,
              name: details.existingProductName,
              sku: details.existingProductSku,
              isActive:
                typeof details.existingProductIsActive === "boolean"
                  ? details.existingProductIsActive
                  : null,
            });
          }
        }
      }

      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível salvar o produto.",
      );
    } finally {
      setIsPending(false);
    }
  }

  const pageTitle = mode === "create" ? "Novo produto" : "Detalhe do produto";
  const pageDescription =
    mode === "create"
      ? "Cadastre o vinho com SKU único, origem, uvas e parâmetros operacionais para vendas, estoque e curadoria."
      : "Edite o cadastro-mãe do vinho sem apagar fisicamente o produto nem perder a rastreabilidade operacional.";

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>{pageTitle}</h1>
          <p className="mt-2 text-sm text-black/55">{pageDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/products">
            Voltar para produtos
          </Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard
          title="Cadastro principal"
          subtitle="SKU único, origem do vinho, descrição comercial e parâmetros base para compras, vendas e estoque."
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  SKU
                </label>
                <div className="space-y-2">
                  <input
                    className="input-soft w-full"
                    placeholder="Ex.: VIN-TINTO-001"
                    value={form.sku}
                    onChange={(event) => {
                      clearDuplicateProductHint();
                      updateField("sku", normalizeSkuValue(event.target.value));
                    }}
                  />
                  <button
                    className="btn-secondary w-full sm:w-auto"
                    onClick={() => setIsScannerOpen(true)}
                    type="button"
                  >
                    Ler código pela câmera
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Nome do produto
                </label>
                <input
                  className="input-soft w-full"
                  placeholder="Ex.: Malbec Reserva 750ml"
                  value={form.name}
                  onChange={(event) => {
                    clearDuplicateProductHint();
                    updateField("name", event.target.value);
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Categoria
                </label>
                <select
                  className="input-soft w-full"
                  value={form.categoryId}
                  onChange={(event) => updateField("categoryId", event.target.value)}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Status
                </label>
                <select
                  className="input-soft w-full"
                  value={form.isActive ? "true" : "false"}
                  onChange={(event) =>
                    updateField("isActive", event.target.value === "true")
                  }
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  País
                </label>
                <input
                  className="input-soft w-full"
                  placeholder="Ex.: Argentina"
                  value={form.countryName}
                  onChange={(event) => updateField("countryName", event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Região
                </label>
                <input
                  className="input-soft w-full"
                  placeholder="Ex.: Mendoza"
                  value={form.regionName}
                  onChange={(event) => updateField("regionName", event.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Casta / uvas
                </label>
                <input
                  className="input-soft w-full"
                  placeholder="Ex.: Malbec, Cabernet Franc"
                  value={form.grapeComposition}
                  onChange={(event) =>
                    updateField("grapeComposition", event.target.value)
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Custo-base unitário
                </label>
                <input
                  className="input-soft w-full"
                  inputMode="decimal"
                  placeholder="Ex.: 45.90"
                  value={form.baseUnitCost}
                  onChange={(event) => updateField("baseUnitCost", event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Estoque base inicial
                </label>
                <input
                  className="input-soft w-full"
                  inputMode="decimal"
                  placeholder="Ex.: 12"
                  value={form.initialStockQty}
                  onChange={(event) =>
                    updateField("initialStockQty", event.target.value)
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Estoque mínimo manual
                </label>
                <input
                  className="input-soft w-full"
                  inputMode="decimal"
                  placeholder="Ex.: 3"
                  value={form.minStockManualQty}
                  onChange={(event) =>
                    updateField("minStockManualQty", event.target.value)
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Descrição do vinho
              </label>
              <textarea
                className="min-h-[120px] w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm outline-none placeholder:text-black/35 focus:border-vinho-900"
                placeholder="Descreva estilo, perfil de paladar, ocasião e argumentos comerciais úteis para a operação."
                value={form.wineDescription}
                onChange={(event) =>
                  updateField("wineDescription", event.target.value)
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Observações de curadoria
              </label>
              <textarea
                className="min-h-[120px] w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm outline-none placeholder:text-black/35 focus:border-vinho-900"
                placeholder="Notas de mix, embalagem, sazonalidade ou particularidades do SKU."
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
              />
            </div>

            {duplicateProduct ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="font-semibold">Este SKU já está cadastrado.</p>
                <p className="mt-2">
                  Produto encontrado: <strong>{duplicateProduct.name}</strong> ({duplicateProduct.sku})
                  {duplicateProduct.isActive === false ? " · Inativo" : ""}.
                </p>
                <div className="mt-3">
                  <Link className="btn-secondary" href={duplicateProduct.href}>
                    Abrir cadastro existente
                  </Link>
                </div>
              </div>
            ) : null}

            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Link className="btn-secondary" href="/products">
                Cancelar
              </Link>
              <button className="btn-primary" disabled={isPending} type="submit">
                {isPending
                  ? "Salvando..."
                  : mode === "create"
                    ? "Criar produto"
                    : "Salvar produto"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Leitura operacional"
          subtitle="Resumo rápido para localizar o vinho, abrir o estoque e evitar duplicidade por SKU."
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-black/5 bg-vinho-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-black/45">
                Entrada por câmera
              </p>
              <p className="mt-2 text-sm text-black/60">
                Leia o código de barras pelo iPhone para preencher o SKU e validar duplicidade antes de salvar.
              </p>
              <button
                className="btn-secondary mt-3 w-full"
                onClick={() => setIsScannerOpen(true)}
                type="button"
              >
                Ler código pela câmera
              </button>
            </div>

            <div className="rounded-2xl border border-black/5 bg-vinho-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-black/45">Status atual</p>
              <div className="mt-3">
                <StatusBadge
                  label={form.isActive ? "Ativo" : "Inativo"}
                  tone={form.isActive ? "success" : "inativo"}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-black/5 bg-vinho-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-black/45">Regras do módulo</p>
              <ul className="mt-3 space-y-2 text-sm text-black/60">
                <li>SKU precisa ser único.</li>
                <li>Produto não é apagado fisicamente.</li>
                <li>Saldo zero não tira o vinho da busca nem do cadastro.</li>
                <li>Canal com preço vazio não grava preço-alvo.</li>
              </ul>
            </div>

            {mode === "edit" && product ? (
              <div className="rounded-2xl border border-black/5 bg-vinho-50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-black/45">
                  Ações rápidas
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Link
                    className="btn-secondary"
                    href={`/products?search=${encodeURIComponent(product.sku)}`}
                  >
                    Localizar este SKU na busca
                  </Link>
                  <Link
                    className="btn-secondary"
                    href={`/inventory?search=${encodeURIComponent(product.sku)}`}
                  >
                    Ver este vinho no estoque
                  </Link>
                  <Link
                    className="btn-primary"
                    href={`/inventory/movements?product_id=${product.id}#ajuste-manual`}
                  >
                    Corrigir saldo real
                  </Link>
                </div>
              </div>
            ) : null}

            {(form.countryName || form.regionName || form.grapeComposition) && (
              <div className="rounded-2xl border border-black/5 bg-vinho-50 px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-black/45">
                  Identidade do vinho
                </p>
                <div className="mt-3 space-y-2 text-sm text-black/60">
                  <p>
                    <strong>País:</strong> {form.countryName || "Não informado"}
                  </p>
                  <p>
                    <strong>Região:</strong> {form.regionName || "Não informada"}
                  </p>
                  <p>
                    <strong>Casta / uvas:</strong>{" "}
                    {form.grapeComposition || "Não informada"}
                  </p>
                </div>
              </div>
            )}

            {categories.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                Crie pelo menos uma categoria em <Link className="underline" href="/products">Produtos</Link> para organizar o mix.
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <BarcodeScannerSheet
        description="Aponte a câmera do iPhone para o código de barras do vinho. Se o SKU já existir, o sistema aponta o cadastro correto."
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={async ({ sku }) => {
          await handleDetectedSku(sku);
        }}
        title="Ler código pela câmera"
      />
    </div>
  );
}
