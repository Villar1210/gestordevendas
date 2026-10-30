// src/features/imoveis/components/construtoras/ConstrutorasTab.tsx
// Construtoras (Fatia A - docs/construtoras/CONTRATO_CONSTRUTORAS.md): aba
// "Construtoras" de Imoveis. Lista + painel lateral (nome, site, logo,
// sobre, diferenciais). So Administrador cria/edita/exclui; os demais
// (Corretor etc.) so leem - o backend bloqueia de verdade.
"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Building2, ExternalLink, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { ApiError, API_BASE_URL } from "@/core/api/client";
import { useMe } from "@/core/hooks/useMe";
import { Construtora, useConstrutoras } from "../../hooks/useConstrutoras";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-600";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

// null = painel fechado; "nova" = criando; Construtora = vendo/editando.
type Selecao = null | "nova" | Construtora;

function LogoMiniatura({ url, nome, tamanho = "h-10 w-10" }: { url: string | null; nome: string; tamanho?: string }) {
  if (!url) {
    return (
      <span className={`flex ${tamanho} flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-400`} aria-hidden>
        <Building2 className="h-5 w-5" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${API_BASE_URL}${url}`}
      alt={`Logo ${nome}`}
      className={`${tamanho} flex-none rounded-lg border border-slate-200 bg-white object-contain p-1`}
    />
  );
}

export function ConstrutorasTab() {
  const { isAdmin } = useMe();
  const { construtoras, carregado, carregar } = useConstrutoras();
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [selecao, setSelecao] = useState<Selecao>(null);

  useEffect(() => {
    carregar().catch((err) =>
      setErroCarregar(err instanceof ApiError ? err.message : "Não foi possível carregar as construtoras."),
    );
  }, [carregar]);

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Construtoras e incorporadoras parceiras. O texto &quot;Sobre&quot; e os diferenciais são usados pela VIVI e pelo
          site nos empreendimentos de cada uma.
        </p>
        {isAdmin && (
          <button
            onClick={() => setSelecao("nova")}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Plus className="h-4 w-4" /> Nova Construtora
          </button>
        )}
      </div>

      {erroCarregar && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {erroCarregar}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <th className="px-4 py-3 font-medium">Construtora</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Site</th>
              <th className="px-4 py-3 font-medium">Empreendimentos</th>
            </tr>
          </thead>
          <tbody>
            {construtoras.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelecao(c)}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <LogoMiniatura url={c.logoUrl} nome={c.nome} />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{c.nome}</p>
                      {!c.sobre && !c.diferenciais && (
                        <p className="text-xs text-slate-400">Sem texto institucional</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="hidden max-w-[240px] truncate px-4 py-3 text-slate-600 sm:table-cell">{c.site ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.quantidadeEmpreendimentos ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {carregado && construtoras.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">Nenhuma construtora cadastrada.</p>
        )}
        {!carregado && !erroCarregar && (
          <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando...
          </p>
        )}
      </div>

      {selecao && (
        <ConstrutoraPainel
          key={selecao === "nova" ? "nova" : selecao.id}
          construtora={selecao === "nova" ? null : selecao}
          podeEditar={isAdmin}
          onFechar={() => setSelecao(null)}
          onSalva={(c) => setSelecao(c)}
        />
      )}
    </div>
  );
}

function ConstrutoraPainel({
  construtora,
  podeEditar,
  onFechar,
  onSalva,
}: {
  construtora: Construtora | null;
  podeEditar: boolean;
  onFechar: () => void;
  onSalva: (c: Construtora) => void;
}) {
  const { criar, atualizar, excluir, enviarLogo, removerLogo } = useConstrutoras();
  const [nome, setNome] = useState(construtora?.nome ?? "");
  const [site, setSite] = useState(construtora?.site ?? "");
  const [sobre, setSobre] = useState(construtora?.sobre ?? "");
  const [diferenciais, setDiferenciais] = useState(construtora?.diferenciais ?? "");
  const [logoUrl, setLogoUrl] = useState(construtora?.logoUrl ?? null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const inputLogo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const titulo = construtora ? construtora.nome : "Nova construtora";
  const quantidade = construtora?.quantidadeEmpreendimentos ?? 0;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!podeEditar) return;
    setErro(null);
    setAviso(null);
    const siteLimpo = site.trim();
    if (siteLimpo && !/^https:\/\//i.test(siteLimpo)) {
      setErro("O site da construtora deve começar com https://.");
      return;
    }
    if (!nome.trim()) {
      setErro("Informe o nome da construtora.");
      return;
    }
    setSalvando(true);
    try {
      const dados = { nome: nome.trim(), site: siteLimpo || null, sobre: sobre.trim() || null, diferenciais: diferenciais.trim() || null };
      const salva = construtora ? await atualizar(construtora.id, dados) : await criar(dados);
      setAviso("Construtora salva.");
      onSalva(salva);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar a construtora.");
    } finally {
      setSalvando(false);
    }
  }

  async function trocarLogo(arquivo: File | undefined) {
    if (!arquivo || !construtora) return;
    setErro(null);
    setAviso(null);
    if (arquivo.size > LOGO_MAX_BYTES) {
      setErro("O logo deve ter no máximo 2 MB.");
      return;
    }
    setEnviandoLogo(true);
    try {
      const atualizada = await enviarLogo(construtora.id, arquivo);
      setLogoUrl(atualizada.logoUrl);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível enviar o logo.");
    } finally {
      setEnviandoLogo(false);
      if (inputLogo.current) inputLogo.current.value = "";
    }
  }

  async function tirarLogo() {
    if (!construtora) return;
    setErro(null);
    setEnviandoLogo(true);
    try {
      await removerLogo(construtora.id);
      setLogoUrl(null);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível remover o logo.");
    } finally {
      setEnviandoLogo(false);
    }
  }

  async function confirmarExclusao() {
    if (!construtora) return;
    setErro(null);
    setSalvando(true);
    try {
      await excluir(construtora.id);
      onFechar();
    } catch (err) {
      // 409 com a quantidade de empreendimentos vinculados (decisao: bloquear).
      setErro(err instanceof ApiError ? err.message : "Não foi possível excluir a construtora.");
      setConfirmandoExclusao(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onFechar}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMiniatura url={logoUrl} nome={titulo} />
            <h2 className="truncate text-lg font-semibold text-slate-800">{titulo}</h2>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={salvar} className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {!podeEditar && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Somente a administração edita construtoras.
            </p>
          )}

          <div>
            <label htmlFor="construtora-nome" className="mb-1 block text-sm text-slate-500">
              Nome
            </label>
            <input
              id="construtora-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={150}
              required
              disabled={!podeEditar}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="construtora-site" className="mb-1 block text-sm text-slate-500">
              Site
            </label>
            {podeEditar ? (
              <input
                id="construtora-site"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={site}
                onChange={(e) => setSite(e.target.value)}
                maxLength={255}
                className={inputClass}
              />
            ) : site ? (
              <a
                id="construtora-site"
                href={site}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 break-all text-sm text-blue-700 hover:underline"
              >
                {site} <ExternalLink className="h-3.5 w-3.5 flex-none" aria-hidden />
              </a>
            ) : (
              <p className="text-sm text-slate-400">-</p>
            )}
          </div>

          <div>
            <p className="mb-1 text-sm text-slate-500">Logo</p>
            {construtora ? (
              <div className="flex flex-wrap items-center gap-3">
                <LogoMiniatura url={logoUrl} nome={titulo} tamanho="h-16 w-16" />
                {podeEditar && (
                  <>
                    <input
                      ref={inputLogo}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => trocarLogo(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => inputLogo.current?.click()}
                      disabled={enviandoLogo}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {enviandoLogo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
                      {logoUrl ? "Trocar logo" : "Enviar logo"}
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={tirarLogo}
                        disabled={enviandoLogo}
                        className="text-sm text-slate-500 hover:text-red-600 disabled:opacity-60"
                      >
                        Remover
                      </button>
                    )}
                    <p className="w-full text-xs text-slate-400">JPG, PNG ou WebP, até 2 MB.</p>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Salve a construtora para enviar o logo.</p>
            )}
          </div>

          <div>
            <label htmlFor="construtora-sobre" className="mb-1 block text-sm text-slate-500">
              Sobre a construtora
            </label>
            <textarea
              id="construtora-sobre"
              value={sobre}
              onChange={(e) => setSobre(e.target.value)}
              rows={5}
              maxLength={2000}
              disabled={!podeEditar}
              placeholder="Ex.: A construtora atua há 20 anos, com mais de 10 mil imóveis entregues..."
              className={inputClass}
            />
            {podeEditar && <p className="mt-1 text-right text-xs text-slate-400">{sobre.length}/2000</p>}
          </div>

          <div>
            <label htmlFor="construtora-diferenciais" className="mb-1 block text-sm text-slate-500">
              Diferenciais
            </label>
            <textarea
              id="construtora-diferenciais"
              value={diferenciais}
              onChange={(e) => setDiferenciais(e.target.value)}
              rows={4}
              maxLength={1500}
              disabled={!podeEditar}
              placeholder="Ex.: Entrega no prazo; atendimento digital; acompanhamento de obra..."
              className={inputClass}
            />
            {podeEditar && <p className="mt-1 text-right text-xs text-slate-400">{diferenciais.length}/1500</p>}
          </div>

          {construtora && (
            <p className="text-xs text-slate-500">
              {quantidade === 0
                ? "Nenhum empreendimento usa esta construtora."
                : `${quantidade} ${quantidade === 1 ? "empreendimento usa" : "empreendimentos usam"} esta construtora.`}
            </p>
          )}

          {erro && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          )}
          {aviso && !erro && (
            <p role="status" className="text-sm text-emerald-700">
              {aviso}
            </p>
          )}

          {podeEditar && (
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={salvando}
                className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {construtora ? "Salvar" : "Criar construtora"}
              </button>
              {construtora && !confirmandoExclusao && (
                <button
                  type="button"
                  onClick={() => setConfirmandoExclusao(true)}
                  className="ml-auto flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Excluir
                </button>
              )}
              {construtora && confirmandoExclusao && (
                <div className="ml-auto flex items-center gap-2 text-sm">
                  <span className="text-slate-600">Excluir mesmo?</span>
                  <button
                    type="button"
                    onClick={confirmarExclusao}
                    disabled={salvando}
                    className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </aside>
    </div>
  );
}
