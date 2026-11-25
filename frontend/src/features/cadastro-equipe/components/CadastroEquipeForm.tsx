// src/features/cadastro-equipe/components/CadastroEquipeForm.tsx
// RH - cadastro completo da equipe interna (25/11/2026, desenho aprovado pelo
// Villar). Ficha em 6 etapas, pensada para o celular. O campo do superior
// muda conforme o cargo e a lista vem dos usuarios do Gestor
// (GET /rh/cadastro-equipe/superiores). Envia para POST /rh/cadastro-equipe.
"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import { CadastroRecebidoScreen } from "@/features/cadastro-publico/components/CadastroRecebidoScreen";
import {
  BANCOS,
  CAMISAS,
  CARGOS,
  casado,
  ESCOLARIDADES,
  ESTADOS_CIVIS,
  ETAPAS,
  FICHA_VAZIA,
  errosDaEtapa,
  paraEnvio,
  QTD_FILHOS,
  TIPOS_PIX,
  UFS,
  type FichaEquipe,
} from "../constants";

const inputCls =
  "h-12 w-full rounded-xl border bg-white px-3.5 text-[15px] text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100";

function Campo({
  rotulo,
  erro,
  obrigatorio = true,
  ajuda,
  children,
}: {
  rotulo: string;
  erro?: string;
  obrigatorio?: boolean;
  ajuda?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-800">
        {rotulo} {obrigatorio && <span className="text-red-700">*</span>}
      </span>
      {children}
      {erro ? (
        <span className="text-xs font-medium text-red-700" role="alert">
          {erro}
        </span>
      ) : ajuda ? (
        <span className="text-xs text-slate-600">{ajuda}</span>
      ) : null}
    </label>
  );
}

function Opcoes({
  legenda,
  opcoes,
  valor,
  onChange,
  erro,
  colunas = 2,
}: {
  legenda: string;
  opcoes: Array<{ valor: string; rotulo: string }>;
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
  colunas?: number;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-slate-800">
        {legenda} <span className="text-red-700">*</span>
      </legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
        {opcoes.map((o) => {
          const marcado = valor === o.valor;
          return (
            <label
              key={o.valor}
              className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3.5 text-sm ${
                marcado ? "border-2 border-blue-700 bg-blue-50 font-semibold text-slate-900" : "border border-slate-300 bg-white text-slate-800"
              }`}
            >
              <input type="radio" checked={marcado} onChange={() => onChange(o.valor)} className="accent-blue-700" />
              {o.rotulo}
            </label>
          );
        })}
      </div>
      {erro && (
        <span className="text-xs font-medium text-red-700" role="alert">
          {erro}
        </span>
      )}
    </fieldset>
  );
}

const SIM_NAO = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
];

export function CadastroEquipeForm() {
  const [f, setF] = useState<FichaEquipe>(FICHA_VAZIA);
  const [etapa, setEtapa] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [superiores, setSuperiores] = useState<Array<{ id: string; nome: string }>>([]);
  const [perguntaSuperior, setPerguntaSuperior] = useState("Quem é o seu superior?");
  const [carregandoSup, setCarregandoSup] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const set = <K extends keyof FichaEquipe>(k: K, v: FichaEquipe[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErros((e) => {
      if (!e[k]) return e;
      const resto = { ...e };
      delete resto[k];
      return resto;
    });
  };
  const bind = (k: keyof FichaEquipe) => ({
    value: String(f[k] ?? ""),
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
    className: `${inputCls} ${erros[k] ? "border-red-600" : "border-slate-300"}`,
    "aria-invalid": !!erros[k] || undefined,
  });

  // Superiores conforme o cargo escolhido.
  useEffect(() => {
    if (!f.cargo) return;
    let vivo = true;
    setCarregandoSup(true);
    apiRequest<{ pergunta: string; superiores: Array<{ id: string; nome: string }> }>(
      `/rh/cadastro-equipe/superiores?cargo=${encodeURIComponent(f.cargo)}`,
    )
      .then((r) => {
        if (!vivo) return;
        setPerguntaSuperior(r.pergunta);
        setSuperiores(r.superiores);
        setF((x) => (r.superiores.some((s) => s.id === x.superiorId) ? x : { ...x, superiorId: "" }));
      })
      .catch(() => vivo && setSuperiores([]))
      .finally(() => vivo && setCarregandoSup(false));
    return () => {
      vivo = false;
    };
  }, [f.cargo]);

  const semSuperiores = !!f.cargo && !carregandoSup && superiores.length === 0;

  function avancar() {
    const e = errosDaEtapa(etapa, f, semSuperiores);
    setErros(e);
    if (Object.keys(e).length) return;
    setEtapa((n) => Math.min(n + 1, ETAPAS.length - 1));
    window.scrollTo({ top: 0 });
  }

  async function enviar() {
    const e = errosDaEtapa(5, f, semSuperiores);
    setErros(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      await apiRequest("/rh/cadastro-equipe", { method: "POST", body: JSON.stringify(paraEnvio(f)) });
      setEnviado(true);
    } catch (err) {
      setErroEnvio(err instanceof ApiError ? err.message : "Não foi possível enviar. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) return <CadastroRecebidoScreen perfil="corretor" />;

  const superiorNome = superiores.find((s) => s.id === f.superiorId)?.nome ?? "Definido pelo RH na aprovação";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2.5 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold leading-tight text-blue-900">
              Gestor
              <br />
              de Vendas
            </span>
            <span className="text-[13px] text-slate-600">
              Etapa {etapa + 1} de {ETAPAS.length}
            </span>
          </div>
          <div aria-hidden="true" className="grid grid-cols-6 gap-1">
            {ETAPAS.map((_, i) => (
              <span key={i} className={`h-1 rounded ${i <= etapa ? "bg-blue-700" : "bg-slate-200"}`} />
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-5">
        <h1 className="text-[22px] font-bold text-slate-900">{ETAPAS[etapa]}</h1>

        {etapa === 0 && (
          <>
            <p className="-mt-2 text-sm leading-relaxed text-slate-600">
              Bem-vindo(a)! Esta ficha reúne os dados para o seu credenciamento na equipe.
            </p>
            <Campo rotulo="Quem indicou você?" erro={erros.indicadoPor}>
              <input type="text" maxLength={150} {...bind("indicadoPor")} />
            </Campo>
            <Opcoes
              legenda="Cargo da entrevista"
              colunas={1}
              opcoes={CARGOS.map((c) => ({ valor: c, rotulo: c }))}
              valor={f.cargo}
              onChange={(v) => set("cargo", v)}
              erro={erros.cargo}
            />
            {f.cargo && semSuperiores && (
              <p className="rounded-xl border border-slate-200 bg-white p-3 text-[13px] leading-relaxed text-slate-700">
                <strong className="block text-slate-900">{perguntaSuperior}</strong>
                Ainda não há ninguém com esse cargo cadastrado no sistema. Pode seguir: o RH define o seu superior na aprovação.
              </p>
            )}
            {f.cargo && !semSuperiores && (
              <Campo
                rotulo={perguntaSuperior}
                erro={erros.superiorId}
              >
                <select {...bind("superiorId")} disabled={carregandoSup}>
                  <option value="">{carregandoSup ? "Carregando..." : "Selecione"}</option>
                  {superiores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            <Opcoes
              legenda="Já trabalhou em alguma empresa do grupo?"
              opcoes={SIM_NAO}
              valor={f.jaTrabalhouNoGrupo}
              onChange={(v) => set("jaTrabalhouNoGrupo", v as FichaEquipe["jaTrabalhouNoGrupo"])}
              erro={erros.jaTrabalhouNoGrupo}
            />
          </>
        )}

        {etapa === 1 && (
          <>
            <Campo rotulo="Nome completo" erro={erros.nome}>
              <input type="text" autoComplete="name" maxLength={150} {...bind("nome")} />
            </Campo>
            <div className="grid grid-cols-2 gap-2.5">
              <Campo rotulo="CPF" erro={erros.cpf}>
                <input type="text" inputMode="numeric" maxLength={14} {...bind("cpf")} />
              </Campo>
              <Campo rotulo="Nascimento" erro={erros.dataNascimento}>
                <input type="date" {...bind("dataNascimento")} />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Campo rotulo="RG / RNE" erro={erros.rg}>
                <input type="text" maxLength={30} {...bind("rg")} />
              </Campo>
              <Campo rotulo="UF do RG" erro={erros.rgUf}>
                <select {...bind("rgUf")}>
                  {UFS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Campo>
            </div>
            <Campo rotulo="Nome completo da mãe" erro={erros.nomeMae}>
              <input type="text" maxLength={150} {...bind("nomeMae")} />
            </Campo>
            <Campo rotulo="Nome completo do pai" erro={erros.nomePai} ajuda='Se não houver, escreva "Não consta".'>
              <input type="text" maxLength={150} {...bind("nomePai")} />
            </Campo>
            <div className="grid grid-cols-2 gap-2.5">
              <Campo rotulo="País de nascimento" erro={erros.paisNascimento}>
                <input type="text" maxLength={60} {...bind("paisNascimento")} />
              </Campo>
              <Campo rotulo="Estado" erro={erros.estadoNascimento}>
                <input type="text" maxLength={40} {...bind("estadoNascimento")} />
              </Campo>
            </div>
            <Campo rotulo="Cidade de nascimento" erro={erros.cidadeNascimento}>
              <input type="text" maxLength={80} {...bind("cidadeNascimento")} />
            </Campo>
            <div className="grid grid-cols-2 gap-2.5">
              <Campo rotulo="Estado civil" erro={erros.estadoCivil}>
                <select {...bind("estadoCivil")}>
                  <option value="">Selecione</option>
                  {ESTADOS_CIVIS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Filhos" erro={erros.quantidadeFilhos}>
                <select {...bind("quantidadeFilhos")}>
                  <option value="">Selecione</option>
                  {QTD_FILHOS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Campo>
            </div>
            {casado(f) && (
              <Campo rotulo="Nome do cônjuge" erro={erros.nomeConjuge}>
                <input type="text" maxLength={150} {...bind("nomeConjuge")} />
              </Campo>
            )}
            <Campo rotulo="E-mail pessoal" erro={erros.email} ajuda="O contrato será enviado para este e-mail, e ele também será o seu login.">
              <input type="email" autoComplete="email" maxLength={150} {...bind("email")} />
            </Campo>
            <Campo rotulo="Celular com DDD" erro={erros.telefone}>
              <input type="tel" autoComplete="tel" maxLength={16} {...bind("telefone")} />
            </Campo>
          </>
        )}

        {etapa === 2 && (
          <>
            <Campo rotulo="CEP" erro={erros.cep}>
              <input type="text" inputMode="numeric" autoComplete="postal-code" maxLength={9} {...bind("cep")} />
            </Campo>
            <Campo rotulo="Rua" erro={erros.rua}>
              <input type="text" autoComplete="address-line1" maxLength={150} {...bind("rua")} />
            </Campo>
            <div className="grid grid-cols-[1fr_2fr] gap-2.5">
              <Campo rotulo="Número" erro={erros.numero}>
                <input type="text" maxLength={20} {...bind("numero")} />
              </Campo>
              <Campo rotulo="Bairro" erro={erros.bairro}>
                <input type="text" maxLength={80} {...bind("bairro")} />
              </Campo>
            </div>
            <Campo rotulo="Cidade" erro={erros.cidade}>
              <input type="text" autoComplete="address-level2" maxLength={80} {...bind("cidade")} />
            </Campo>
          </>
        )}

        {etapa === 3 && (
          <>
            <Campo rotulo="Escolaridade" erro={erros.escolaridade}>
              <select {...bind("escolaridade")}>
                <option value="">Selecione</option>
                {ESCOLARIDADES.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Campo>
            <Opcoes
              legenda="Você possui CRECI ativo?"
              opcoes={SIM_NAO}
              valor={f.possuiCreci}
              onChange={(v) => set("possuiCreci", v as FichaEquipe["possuiCreci"])}
              erro={erros.possuiCreci}
            />
            {f.possuiCreci === "sim" && (
              <>
                <Opcoes
                  legenda="Tipo de CRECI"
                  opcoes={[
                    { valor: "Estágio", rotulo: "Estágio" },
                    { valor: "Definitivo", rotulo: "Definitivo" },
                  ]}
                  valor={f.creciTipo}
                  onChange={(v) => set("creciTipo", v)}
                  erro={erros.creciTipo}
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <Campo rotulo="Número do CRECI" erro={erros.creciNumero}>
                    <input type="text" maxLength={30} {...bind("creciNumero")} />
                  </Campo>
                  <Campo rotulo="Validade" erro={erros.creciValidade}>
                    <input type="date" {...bind("creciValidade")} />
                  </Campo>
                </div>
              </>
            )}
            <Campo rotulo="Nome do supervisor do CRECI" obrigatorio={false}>
              <input type="text" maxLength={150} {...bind("creciSupervisor")} />
            </Campo>
          </>
        )}

        {etapa === 4 && (
          <>
            <p className="-mt-2 text-sm text-slate-600">Para receber as suas comissões.</p>
            <p className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[13px] leading-relaxed text-blue-950">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
              Seus dados bancários ficam protegidos: só a administração pode ver.
            </p>
            <Campo rotulo="Banco" erro={erros.banco}>
              <select {...bind("banco")}>
                <option value="">Selecione o banco</option>
                {BANCOS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-2.5">
              <Campo rotulo="Agência" erro={erros.agencia}>
                <input type="text" inputMode="numeric" maxLength={10} {...bind("agencia")} />
              </Campo>
              <Campo rotulo="Conta com dígito" erro={erros.conta}>
                <input type="text" placeholder="00000-0" maxLength={20} {...bind("conta")} />
              </Campo>
            </div>
            <Opcoes
              legenda="Tipo de conta"
              opcoes={[
                { valor: "Corrente", rotulo: "Corrente" },
                { valor: "Poupança", rotulo: "Poupança" },
              ]}
              valor={f.tipoConta}
              onChange={(v) => set("tipoConta", v)}
              erro={erros.tipoConta}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <Campo rotulo="Tipo de PIX" erro={erros.tipoPix}>
                <select {...bind("tipoPix")}>
                  <option value="">Selecione</option>
                  {TIPOS_PIX.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Chave PIX" erro={erros.chavePix}>
                <input type="text" maxLength={80} {...bind("chavePix")} />
              </Campo>
            </div>
            <p className="-mt-2 text-xs text-slate-600">O pagamento é feito só por PIX vinculado ao seu CPF.</p>
            <Opcoes
              legenda="Tem CNPJ ativo e prefere se cadastrar como pessoa jurídica?"
              opcoes={SIM_NAO}
              valor={f.optaPj}
              onChange={(v) => set("optaPj", v as FichaEquipe["optaPj"])}
              erro={erros.optaPj}
            />
            {f.optaPj === "sim" && (
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <span className="text-[13px] font-bold text-slate-700">Dados da empresa (PJ)</span>
                <Campo rotulo="CNPJ" erro={erros.cnpj}>
                  <input type="text" inputMode="numeric" placeholder="00.000.000/0000-00" maxLength={18} {...bind("cnpj")} />
                </Campo>
                <Campo rotulo="Banco da PJ" erro={erros.pjBanco}>
                  <select {...bind("pjBanco")}>
                    <option value="">Selecione o banco</option>
                    {BANCOS.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </Campo>
                <div className="grid grid-cols-2 gap-2.5">
                  <Campo rotulo="Agência" erro={erros.pjAgencia}>
                    <input type="text" inputMode="numeric" maxLength={10} {...bind("pjAgencia")} />
                  </Campo>
                  <Campo rotulo="Conta com dígito" erro={erros.pjConta}>
                    <input type="text" maxLength={20} {...bind("pjConta")} />
                  </Campo>
                </div>
              </div>
            )}
          </>
        )}

        {etapa === 5 && (
          <>
            <Opcoes
              legenda="Tamanho da camisa"
              colunas={6}
              opcoes={CAMISAS.map((c) => ({ valor: c, rotulo: c }))}
              valor={f.tamanhoCamisa}
              onChange={(v) => set("tamanhoCamisa", v)}
              erro={erros.tamanhoCamisa}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <Campo rotulo="Crie uma senha" erro={erros.senha}>
                <input type="password" autoComplete="new-password" maxLength={72} {...bind("senha")} />
              </Campo>
              <Campo rotulo="Repita a senha" erro={erros.senha2}>
                <input type="password" autoComplete="new-password" maxLength={72} {...bind("senha2")} />
              </Campo>
            </div>
            <section aria-label="Resumo do cadastro" className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <span className="text-[13px] font-bold text-slate-700">Confira antes de enviar</span>
              {[
                ["Nome", f.nome],
                ["Cargo", f.cargo],
                [perguntaSuperior.replace(/^Quem é o seu /, "").replace(/\?$/, ""), superiorNome],
                ["CRECI", f.possuiCreci === "sim" ? `${f.creciTipo} · ${f.creciNumero}` : "Não possui"],
                ["Pagamento", `PIX ${f.tipoPix}${f.optaPj === "sim" ? " · PJ" : ""}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span className="text-slate-600 first-letter:uppercase">{k}</span>
                  <span className="text-right font-semibold text-slate-900">{v}</span>
                </div>
              ))}
              <button type="button" onClick={() => setEtapa(0)} className="self-start text-[13px] font-semibold text-blue-700 hover:underline">
                Corrigir algum dado
              </button>
            </section>
            <label
              className={`flex items-start gap-3 rounded-xl border-2 bg-white p-4 ${erros.aceiteLgpd ? "border-red-600" : "border-blue-700"}`}
            >
              <input
                type="checkbox"
                checked={f.aceiteLgpd}
                onChange={(e) => set("aceiteLgpd", e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-blue-700"
              />
              <span className="text-[13px] leading-relaxed text-slate-800">
                Li e concordo que os dados desta ficha serão usados <strong>somente para o meu cadastro e credenciamento</strong> na
                equipe, conforme a Lei Geral de Proteção de Dados (LGPD). <span className="text-red-700">*</span>
              </span>
            </label>
            {erroEnvio && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
                {erroEnvio}
              </p>
            )}
          </>
        )}

        {Object.keys(erros).length > 0 && etapa < 5 && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
            Confira os campos marcados em vermelho.
          </p>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-lg gap-2.5 px-5 py-3">
          {etapa === 0 ? (
            <Link
              href="/cadastro"
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 text-[15px] font-semibold text-slate-700"
            >
              Sair
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setErros({});
                setEtapa((n) => n - 1);
              }}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 text-[15px] font-semibold text-slate-700"
            >
              Voltar
            </button>
          )}
          {etapa < ETAPAS.length - 1 ? (
            <button
              type="button"
              onClick={avancar}
              className="flex min-h-12 flex-[2] items-center justify-center rounded-xl bg-blue-700 text-[15px] font-semibold text-white hover:bg-blue-800"
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              onClick={enviar}
              disabled={enviando}
              className="flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-green-700 text-[15px] font-bold text-white hover:bg-green-800 disabled:opacity-60"
            >
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Enviar cadastro
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
