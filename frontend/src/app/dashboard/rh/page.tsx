// src/app/dashboard/rh/page.tsx
// RH - cadastros da equipe interna (25/11/2026, desenho aprovado pelo Villar).
// Lista por situacao (para aprovar / aprovados / recusados) e a ficha do
// candidato em blocos. Dados bancarios mascarados ate clicar em "Mostrar
// dados" (fica registrado quem viu). Aprovacao com cargo e superior ja
// preenchidos com o que o candidato escolheu. Cadastros de parceiros e
// clientes continuam em /dashboard/rh/aprovacoes.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Copy, Eye, Loader2, Search } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import { CARGO_HIERARQUICO_OPTIONS } from "@/core/constants/cargoHierarquico";

type Situacao = "pendente" | "aprovado" | "rejeitado";
type SituacaoCreci = "sem_creci" | "vencido" | "vencendo" | "ok";

interface ItemLista {
  id: string;
  nome: string;
  email: string;
  enviadoEm: string;
  indicadoPor: string;
  cargo: string;
  superior: { id: string; nome: string; cargo: string | null } | null;
  creci: { tipo: string | null; validade: string | null; situacao: SituacaoCreci };
  motivoRecusa: string | null;
}

interface Ficha {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  situacao: string;
  enviadoEm: string;
  indicacao: { indicadoPor: string; cargo: string; jaTrabalhouNoGrupo: boolean };
  superior: { id: string; nome: string; cargo: string | null } | null;
  aprovacaoSugerida: { cargoHierarquico: string; superioresPermitidos: string[] } | null;
  pessoais: Record<string, string | null>;
  endereco: { rua: string; numero: string; bairro: string; cidade: string; cep: string };
  escolaridade: string;
  tamanhoCamisa: string;
  creci: { possui: boolean; tipo: string | null; numero: string | null; validade: string | null; supervisor: string | null; situacao: SituacaoCreci };
  pagamento: Record<string, string | boolean | null>;
  aceiteLgpdEm: string;
  motivoRecusa: string | null;
  acessosAosDadosBancarios: Array<{ quem: string; em: string }>;
}

const rotuloCargo = (c: string | null) => CARGO_HIERARQUICO_OPTIONS.find((o) => o.value === c)?.label.toLowerCase() ?? c ?? "";
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtCpf = (c: string | null) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c ?? "—");
const fmtTel = (t: string | null) => (t && t.length >= 10 ? `(${t.slice(0, 2)}) ${t.slice(2, -4)}-${t.slice(-4)}` : t ?? "—");

function SeloCreci({ c }: { c: ItemLista["creci"] }) {
  const estilos: Record<SituacaoCreci, [string, string]> = {
    ok: ["bg-green-100 text-green-800", `${c.tipo ?? ""} · ${c.validade ? new Date(c.validade).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric", timeZone: "UTC" }) : ""}`],
    vencendo: ["bg-amber-100 text-amber-900", `Vence ${data(c.validade)}`],
    vencido: ["bg-amber-100 text-amber-900", `Vencido ${data(c.validade)}`],
    sem_creci: ["bg-amber-100 text-amber-900", "Sem CRECI"],
  };
  const [cls, txt] = estilos[c.situacao];
  return <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{txt}</span>;
}

export default function RhCadastrosPage() {
  const [situacao, setSituacao] = useState<Situacao>("pendente");
  const [lista, setLista] = useState<ItemLista[]>([]);
  const [contagem, setContagem] = useState({ pendente: 0, aprovado: 0, rejeitado: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [cargo, setCargo] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await apiRequest<{ contagem: typeof contagem; cadastros: ItemLista[] }>(`/rh/cadastros-equipe?situacao=${situacao}`);
      setLista(r.cadastros);
      setContagem(r.contagem);
      setErro(null);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível carregar os cadastros.");
    } finally {
      setCarregando(false);
    }
  }, [situacao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((c) => (!cargo || c.cargo === cargo) && (!q || c.nome.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)));
  }, [lista, busca, cargo]);
  const cargos = useMemo(() => Array.from(new Set(lista.map((c) => c.cargo))).sort(), [lista]);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/cadastro/equipe`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  if (abertoId) {
    return (
      <FichaCandidato
        id={abertoId}
        onVoltar={() => setAbertoId(null)}
        onMudou={() => {
          setAbertoId(null);
          carregar();
        }}
      />
    );
  }

  const abas: Array<[Situacao, string, number]> = [
    ["pendente", "Para aprovar", contagem.pendente],
    ["aprovado", "Aprovados", contagem.aprovado],
    ["rejeitado", "Recusados", contagem.rejeitado],
  ];

  return (
    <div className="flex flex-col gap-5 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastros da equipe</h1>
          <p className="text-sm text-slate-600">Fichas enviadas pela tela inicial. Confira e aprove para liberar o acesso.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/rh/aprovacoes"
            className="flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Parceiros e clientes
          </Link>
          <button
            onClick={copiarLink}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Copy className="h-4 w-4" aria-hidden="true" /> {copiado ? "Link copiado!" : "Copiar link do cadastro"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Situação" className="flex gap-1 rounded-xl bg-slate-200 p-1">
          {abas.map(([v, r, n]) => (
            <button
              key={v}
              role="tab"
              aria-selected={situacao === v}
              onClick={() => setSituacao(v)}
              className={`rounded-lg px-3.5 py-2 text-sm ${situacao === v ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-700"}`}
            >
              {r} · {n}
            </button>
          ))}
        </div>
        <label className="flex h-11 min-w-[14rem] flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
          <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <select
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          aria-label="Cargo"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800"
        >
          <option value="">Todos os cargos</option>
          {cargos.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {carregando ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </p>
        ) : erro ? (
          <p className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p>
        ) : filtrados.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-600">Nenhum cadastro aqui.</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-5 py-3.5 font-semibold">Candidato</th>
                <th className="px-3 py-3.5 font-semibold">Cargo</th>
                <th className="px-3 py-3.5 font-semibold">Superior indicado</th>
                <th className="px-3 py-3.5 font-semibold">CRECI</th>
                <th className="px-3 py-3.5 font-semibold">{situacao === "rejeitado" ? "Motivo" : "Enviado"}</th>
                <th className="px-5 py-3.5">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-900">{c.nome}</p>
                    <p className="text-[13px] text-slate-600">Indicado(a) por {c.indicadoPor}</p>
                  </td>
                  <td className="px-3 py-3.5 text-slate-800">{c.cargo}</td>
                  <td className="px-3 py-3.5 text-slate-800">
                    {c.superior ? (
                      <>
                        {c.superior.nome} <span className="text-slate-600">· {rotuloCargo(c.superior.cargo)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    <SeloCreci c={c.creci} />
                  </td>
                  <td className="max-w-[16rem] px-3 py-3.5 text-slate-600">
                    {situacao === "rejeitado" ? c.motivoRecusa ?? "—" : dataHora(c.enviadoEm)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setAbertoId(c.id)}
                      className={`inline-flex min-h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold ${
                        situacao === "pendente" ? "bg-blue-700 text-white hover:bg-blue-800" : "border border-slate-300 text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      Abrir ficha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[13px] text-slate-600">CRECI vencido, vencendo em 30 dias ou ausente aparece em laranja. Só o Administrador vê esta tela.</p>
    </div>
  );
}

function Bloco({ titulo, acao, children, larga }: { titulo: string; acao?: ReactNode; children: ReactNode; larga?: boolean }) {
  return (
    <section className={`flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 ${larga ? "md:col-span-2" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-900">{titulo}</h2>
        {acao}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">{children}</dl>
    </section>
  );
}

function Item({ rotulo, valor, larga }: { rotulo: string; valor: ReactNode; larga?: boolean }) {
  return (
    <div className={larga ? "col-span-2" : ""}>
      <dt className="text-[13px] text-slate-600">{rotulo}</dt>
      <dd className="text-sm font-semibold text-slate-900">{valor || "—"}</dd>
    </div>
  );
}

function FichaCandidato({ id, onVoltar, onMudou }: { id: string; onVoltar: () => void; onMudou: () => void }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [revelando, setRevelando] = useState(false);
  const [superiores, setSuperiores] = useState<Array<{ id: string; name: string; cargoHierarquico: string | null }>>([]);
  const [cargoH, setCargoH] = useState("");
  const [superiorId, setSuperiorId] = useState("");
  const [acao, setAcao] = useState<"aprovar" | "recusar" | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const f = await apiRequest<Ficha>(`/rh/cadastros-equipe/${id}`);
      setFicha(f);
      setCargoH(f.aprovacaoSugerida?.cargoHierarquico ?? "corretor");
      setSuperiorId(f.superior?.id ?? "");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível abrir a ficha.");
    }
  }, [id]);

  useEffect(() => {
    carregar();
    apiRequest<Array<{ id: string; name: string; cargoHierarquico: string | null }>>("/rh/possiveis-superiores")
      .then(setSuperiores)
      .catch(() => setSuperiores([]));
  }, [carregar]);

  async function mostrarPagamento() {
    setRevelando(true);
    try {
      const p = await apiRequest<Record<string, string | boolean | null>>(`/rh/cadastros-equipe/${id}/pagamento`, { method: "POST" });
      setFicha((f) => (f ? { ...f, pagamento: p } : f));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível mostrar os dados.");
    } finally {
      setRevelando(false);
    }
  }

  async function aprovar() {
    setAcao("aprovar");
    setErroAcao(null);
    try {
      await apiRequest(`/rh/cadastros/${id}/aprovar`, {
        method: "POST",
        body: JSON.stringify({ cargoHierarquico: cargoH, ...(superiorId ? { superiorId } : {}) }),
      });
      onMudou();
    } catch (err) {
      setErroAcao(err instanceof ApiError ? err.message : "Não foi possível aprovar.");
    } finally {
      setAcao(null);
    }
  }

  async function recusar() {
    setAcao("recusar");
    setErroAcao(null);
    try {
      await apiRequest(`/rh/cadastros/${id}/rejeitar`, { method: "POST", body: JSON.stringify(motivo.trim() ? { motivo: motivo.trim() } : {}) });
      onMudou();
    } catch (err) {
      setErroAcao(err instanceof ApiError ? err.message : "Não foi possível recusar.");
    } finally {
      setAcao(null);
    }
  }

  if (erro && !ficha) {
    return (
      <div className="p-8">
        <button onClick={onVoltar} className="mb-4 text-sm font-semibold text-blue-700">
          ← Cadastros da equipe
        </button>
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p>
      </div>
    );
  }
  if (!ficha) {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Abrindo a ficha...
      </p>
    );
  }

  const p = ficha.pagamento;
  const pendente = ficha.situacao === "pendente_aprovacao";
  const permitidos = cargoH === ficha.aprovacaoSugerida?.cargoHierarquico ? ficha.aprovacaoSugerida.superioresPermitidos : null;
  const opcoesSuperior = superiores.filter((s) => s.id !== ficha.id && (!permitidos || permitidos.includes(s.cargoHierarquico ?? "")));
  const iniciais = ficha.nome
    .split(/\s+/)
    .filter(Boolean)
    .map((x, i, a) => (i === 0 || i === a.length - 1 ? x[0] : ""))
    .join("")
    .toUpperCase();
  const situacaoTxt = pendente ? "Aguardando aprovação" : ficha.situacao === "aprovado" ? "Aprovado" : "Recusado";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6 md:p-8">
      <button onClick={onVoltar} className="flex items-center gap-1.5 self-start text-sm font-semibold text-blue-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Cadastros da equipe
      </button>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center gap-3.5">
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-800">
            {iniciais}
          </span>
          <div>
            <h1 className="text-[22px] font-bold text-slate-900">{ficha.nome}</h1>
            <p className="text-sm text-slate-600">
              {ficha.indicacao.cargo} · indicado(a) por {ficha.indicacao.indicadoPor} · enviada em {dataHora(ficha.enviadoEm)}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${
            pendente ? "bg-amber-100 text-amber-900" : ficha.situacao === "aprovado" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {situacaoTxt}
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="grid min-w-0 flex-[999_1_560px] grid-cols-1 gap-4 md:grid-cols-2">
          <Bloco titulo="Dados pessoais">
            <Item rotulo="CPF" valor={fmtCpf(ficha.cpf)} />
            <Item rotulo="RG / UF" valor={`${ficha.pessoais.rg} · ${ficha.pessoais.rgUf}`} />
            <Item rotulo="Nascimento" valor={data(ficha.pessoais.dataNascimento)} />
            <Item rotulo="Natural de" valor={`${ficha.pessoais.cidadeNascimento} · ${ficha.pessoais.estadoNascimento} · ${ficha.pessoais.paisNascimento}`} />
            <Item rotulo="Estado civil" valor={ficha.pessoais.estadoCivil} />
            <Item rotulo="Filhos" valor={ficha.pessoais.quantidadeFilhos} />
            {ficha.pessoais.nomeConjuge && <Item rotulo="Cônjuge" valor={ficha.pessoais.nomeConjuge} larga />}
            <Item rotulo="Mãe" valor={ficha.pessoais.nomeMae} />
            <Item rotulo="Pai" valor={ficha.pessoais.nomePai} />
          </Bloco>
          <Bloco titulo="Contato e endereço">
            <Item rotulo="E-mail" valor={ficha.email} />
            <Item rotulo="Celular" valor={fmtTel(ficha.telefone)} />
            <Item
              rotulo="Endereço"
              larga
              valor={`${ficha.endereco.rua}, ${ficha.endereco.numero} · ${ficha.endereco.bairro} · ${ficha.endereco.cidade} · ${ficha.endereco.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`}
            />
            <Item rotulo="Escolaridade" valor={ficha.escolaridade} />
            <Item rotulo="Camisa" valor={ficha.tamanhoCamisa} />
          </Bloco>
          <Bloco titulo="CRECI">
            {ficha.creci.possui ? (
              <>
                <Item rotulo="Número" valor={ficha.creci.numero} />
                <Item rotulo="Tipo" valor={ficha.creci.tipo} />
                <Item
                  rotulo="Validade"
                  valor={<span className={ficha.creci.situacao === "ok" ? "text-green-800" : "text-amber-800"}>{data(ficha.creci.validade)}</span>}
                />
              </>
            ) : (
              <Item rotulo="Situação" valor={<span className="text-amber-800">Não possui CRECI</span>} />
            )}
            <Item rotulo="Supervisor do CRECI" valor={ficha.creci.supervisor} />
          </Bloco>
          <Bloco
            titulo="Pagamento"
            acao={
              p.mascarado ? (
                <button
                  onClick={mostrarPagamento}
                  disabled={revelando}
                  className="flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[13px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  {revelando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                  Mostrar dados
                </button>
              ) : null
            }
          >
            <Item rotulo="Banco" valor={String(p.banco ?? "")} />
            <Item rotulo="Conta" valor={`Ag ${p.agencia} · ${p.tipoConta === "Poupança" ? "CP" : "CC"} ${p.conta}`} />
            <Item rotulo="PIX" valor={`${p.tipoPix} · ${p.chavePix}`} larga />
            <Item
              rotulo="Pessoa jurídica"
              larga
              valor={p.optaPj ? `CNPJ ${p.cnpj} · ${p.pjBanco} · Ag ${p.pjAgencia} · Conta ${p.pjConta}` : "Não"}
            />
            <div className="col-span-2 text-xs text-slate-600">
              Cada vez que alguém clica em &quot;Mostrar dados&quot;, fica registrado quem viu e quando.
              {ficha.acessosAosDadosBancarios.length > 0 &&
                ` Último acesso: ${ficha.acessosAosDadosBancarios[0].quem}, ${dataHora(ficha.acessosAosDadosBancarios[0].em)}.`}
            </div>
          </Bloco>
          <section className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[13px] text-slate-700 md:col-span-2">
            <span>
              <strong>Já trabalhou no grupo:</strong> {ficha.indicacao.jaTrabalhouNoGrupo ? "Sim" : "Não"}
            </span>
            <span>
              <strong>Aceite LGPD:</strong> sim, em {dataHora(ficha.aceiteLgpdEm)}
            </span>
            {ficha.motivoRecusa && (
              <span>
                <strong>Motivo da recusa:</strong> {ficha.motivoRecusa}
              </span>
            )}
          </section>
        </div>

        {pendente && (
          <aside aria-label="Aprovação" className="flex max-w-sm flex-[1_1_300px] flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-bold text-slate-900">Aprovar acesso</h2>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-800">Cargo no Gestor</span>
              <select value={cargoH} onChange={(e) => setCargoH(e.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm">
                {CARGO_HIERARQUICO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-600">Cargo na ficha: {ficha.indicacao.cargo}</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-800">Superior</span>
              <select value={superiorId} onChange={(e) => setSuperiorId(e.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm">
                <option value="">Sem superior</option>
                {opcoesSuperior.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {rotuloCargo(s.cargoHierarquico)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-600">Já vem com o que o candidato escolheu; o RH pode trocar.</span>
            </label>
            <p className="rounded-xl bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700">
              Ao aprovar, o Gestor libera o acesso com este cargo e superior e envia o contrato de prestação de serviço para assinatura.
            </p>
            {erroAcao && <p className="rounded-lg bg-red-50 p-2.5 text-[13px] text-red-800">{erroAcao}</p>}
            <button
              onClick={aprovar}
              disabled={!!acao}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-green-700 text-[15px] font-bold text-white hover:bg-green-800 disabled:opacity-60"
            >
              {acao === "aprovar" && <Loader2 className="h-4 w-4 animate-spin" />} Aprovar cadastro
            </button>
            {!recusando ? (
              <button
                onClick={() => setRecusando(true)}
                className="min-h-11 rounded-xl border border-red-300 bg-white text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Recusar com motivo
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-red-900">Motivo da recusa</span>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="resize-none rounded-lg border border-red-200 bg-white p-2 text-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setRecusando(false)} className="min-h-10 flex-1 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700">
                    Cancelar
                  </button>
                  <button
                    onClick={recusar}
                    disabled={!!acao}
                    className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-700 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {acao === "recusar" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirmar recusa
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
