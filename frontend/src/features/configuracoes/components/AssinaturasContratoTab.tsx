// src/features/configuracoes/components/AssinaturasContratoTab.tsx
// "Assinaturas do Contrato": quem assina o contrato de prestacao de servico
// gerado na aprovacao do corretor/parceiro (alem do proprio contratado) e se
// o acesso dele espera a assinatura. Cada empresa (tenant) configura o seu -
// sem configurar, vale o comportamento original (so o contratado assina).
"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";

interface ContratoParceriaConfig {
  assinaturaEmpresaAtiva: boolean;
  representanteNome: string | null;
  representanteEmail: string | null;
  representanteCargo: string | null;
  quantidadeTestemunhas: number;
  testemunha1Nome: string | null;
  testemunha1Email: string | null;
  testemunha2Nome: string | null;
  testemunha2Email: string | null;
  bloquearAcessoAteAssinar: boolean;
  lembretesAtivos: boolean;
  lembreteDias: string;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-slate-500";

function Campo({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}

function Interruptor({
  ativo,
  onChange,
  titulo,
  descricao,
}: {
  ativo: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  descricao: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p id={id} className="text-sm font-semibold text-slate-800">
          {titulo}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-labelledby={id}
        onClick={() => onChange(!ativo)}
        className={`relative mt-1 h-6 w-11 flex-none rounded-full transition ${ativo ? "bg-blue-600" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${ativo ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

export function AssinaturasContratoTab() {
  const [config, setConfig] = useState<ContratoParceriaConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<ContratoParceriaConfig>("/rh/contrato-parceria-config")
      .then((c) => active && setConfig(c))
      .catch((err) => active && setErro(err instanceof ApiError ? err.message : "Não foi possível carregar a configuração."));
    return () => {
      active = false;
    };
  }, []);

  function atualizar<K extends keyof ContratoParceriaConfig>(campo: K, valor: ContratoParceriaConfig[K]) {
    setConfig((c) => (c ? { ...c, [campo]: valor } : c));
    setSalvoEm(null);
  }

  async function handleSalvar() {
    if (!config) return;
    setIsSaving(true);
    setErro(null);
    try {
      const salvo = await apiRequest<ContratoParceriaConfig>("/rh/contrato-parceria-config", {
        method: "PUT",
        body: JSON.stringify(config),
      });
      setConfig(salvo);
      setSalvoEm(new Date());
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar a configuração.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!config) {
    return erro ? (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {erro}
      </p>
    ) : (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando configuração...</p>
      </div>
    );
  }

  const ordem = [
    "Contratado (corretor ou parceiro)",
    ...(config.assinaturaEmpresaAtiva ? ["Representante da empresa"] : []),
    ...Array.from({ length: config.quantidadeTestemunhas }, (_, i) => `Testemunha ${i + 1}`),
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Quando o RH aprova um corretor ou parceiro, o contrato de prestação de serviço é gerado e enviado pelo
          E-doc. Aqui você define quem mais assina e o que acontece até a assinatura.
        </p>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <Interruptor
            ativo={config.assinaturaEmpresaAtiva}
            onChange={(v) => atualizar("assinaturaEmpresaAtiva", v)}
            titulo="A empresa também assina"
            descricao="O representante da empresa (contratante) assina depois do contratado."
          />
          {config.assinaturaEmpresaAtiva && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo label="Nome do representante" value={config.representanteNome} onChange={(v) => atualizar("representanteNome", v)} />
              <Campo
                label="E-mail"
                type="email"
                value={config.representanteEmail}
                onChange={(v) => atualizar("representanteEmail", v)}
              />
              <Campo
                label="Cargo (opcional)"
                value={config.representanteCargo}
                placeholder="Ex: Diretor"
                onChange={(v) => atualizar("representanteCargo", v)}
              />
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Testemunhas</p>
            <p className="mt-0.5 text-sm text-slate-500">Assinam por último, depois das partes.</p>
          </div>
          <div role="radiogroup" aria-label="Quantidade de testemunhas" className="flex w-fit rounded-lg border border-slate-200 p-0.5">
            {[0, 1, 2].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={config.quantidadeTestemunhas === n}
                onClick={() => atualizar("quantidadeTestemunhas", n)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  config.quantidadeTestemunhas === n ? "bg-blue-700 text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {n === 0 ? "Nenhuma" : n === 1 ? "1 testemunha" : "2 testemunhas"}
              </button>
            ))}
          </div>
          {config.quantidadeTestemunhas >= 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Testemunha 1 – nome" value={config.testemunha1Nome} onChange={(v) => atualizar("testemunha1Nome", v)} />
              <Campo
                label="Testemunha 1 – e-mail"
                type="email"
                value={config.testemunha1Email}
                onChange={(v) => atualizar("testemunha1Email", v)}
              />
            </div>
          )}
          {config.quantidadeTestemunhas >= 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Testemunha 2 – nome" value={config.testemunha2Nome} onChange={(v) => atualizar("testemunha2Nome", v)} />
              <Campo
                label="Testemunha 2 – e-mail"
                type="email"
                value={config.testemunha2Email}
                onChange={(v) => atualizar("testemunha2Email", v)}
              />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <Interruptor
            ativo={config.bloquearAcessoAteAssinar}
            onChange={(v) => atualizar("bloquearAcessoAteAssinar", v)}
            titulo="Liberar o acesso só depois da assinatura"
            descricao="O corretor aprovado só consegue entrar na plataforma quando todas as assinaturas do contrato forem concluídas."
          />
        </section>

        {erro && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSalvar}
            disabled={isSaving}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
          {salvoEm && (
            <span role="status" className="inline-flex items-center gap-1 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Configuração salva
            </span>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ordem de assinatura</p>
        <ol className="mt-3 space-y-2">
          {ordem.map((nome, i) => (
            <li key={nome} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                {i + 1}
              </span>
              {nome}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          Cada pessoa recebe o link por e-mail quando chega a vez dela. As mudanças valem para os próximos contratos
          gerados, não para os já enviados.
        </p>
      </aside>
    </div>
  );
}
