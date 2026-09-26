"use client";
// src/features/site-publico/components/LeadForm.tsx
// Formulario "Tenho interesse". Envia para /api/public/site/:slug/leads
// na MESMA origem da pagina (o nginx de cada dominio encaminha /api para
// o backend) - assim nao depende de CORS, que so libera o dominio da
// plataforma.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";

interface Props {
  slug: string;
  base: string;
  imovelId?: string;
  empreendimentoId?: string;
  titulo?: string;
  mensagemInicial?: string;
}

type Estado = { tipo: "ocioso" } | { tipo: "enviando" } | { tipo: "enviado" } | { tipo: "erro"; mensagem: string };

const campo =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

function mascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// So mostramos ao visitante as mensagens que escrevemos no backend
// (RegistrarLeadSiteDto); qualquer outra vira o texto generico.
const MENSAGENS_CONHECIDAS = new Set([
  "Informe seu nome.",
  "Informe um telefone válido com DDD.",
  "Informe um e-mail válido.",
  "É preciso aceitar a política de privacidade.",
]);

async function lerErro(res: Response): Promise<string> {
  if (res.status === 429) return "Recebemos muitas mensagens deste endereço. Tente de novo em alguns minutos.";
  try {
    const corpo = (await res.json()) as { message?: string | string[] };
    const msg = Array.isArray(corpo.message) ? corpo.message[0] : corpo.message;
    if (msg && res.status === 400 && MENSAGENS_CONHECIDAS.has(msg)) return msg;
  } catch {
    // resposta sem JSON - cai na mensagem generica
  }
  return "Não foi possível enviar agora. Tente novamente em instantes.";
}

export function LeadForm({ slug, base, imovelId, empreendimentoId, titulo = "Tenho interesse", mensagemInicial }: Props) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState(mensagemInicial ?? "");
  const [aceite, setAceite] = useState(false);
  const [website, setWebsite] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "ocioso" });
  const sucessoRef = useRef<HTMLDivElement>(null);

  // Ao trocar o formulario pela confirmacao, leva o foco para ela (leitor
  // de tela anuncia e o teclado nao "cai" no topo da pagina).
  useEffect(() => {
    if (estado.tipo === "enviado") sucessoRef.current?.focus();
  }, [estado.tipo]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!aceite) {
      setEstado({ tipo: "erro", mensagem: "É preciso aceitar a política de privacidade." });
      return;
    }
    setEstado({ tipo: "enviando" });
    try {
      const res = await fetch(`/api/public/site/${encodeURIComponent(slug)}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone,
          email: email.trim() || undefined,
          mensagem: mensagem.trim() || undefined,
          imovelId,
          empreendimentoId,
          aceiteLgpd: true,
          website: website || undefined,
        }),
      });
      if (!res.ok) {
        setEstado({ tipo: "erro", mensagem: await lerErro(res) });
        return;
      }
      setEstado({ tipo: "enviado" });
    } catch {
      setEstado({ tipo: "erro", mensagem: "Sem conexão com o servidor. Verifique sua internet e tente de novo." });
    }
  }

  if (estado.tipo === "enviado") {
    return (
      <div ref={sucessoRef} tabIndex={-1} role="status" className="rounded-2xl border border-emerald-200 outline-none bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
        <p className="mt-3 font-semibold text-emerald-800">Mensagem enviada!</p>
        <p className="mt-1 text-sm text-emerald-700">Um corretor vai entrar em contato com você em breve.</p>
      </div>
    );
  }

  const enviando = estado.tipo === "enviando";

  return (
    <form onSubmit={enviar} className="relative space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" noValidate>
      <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Nome <span className="text-red-600" aria-hidden>*</span></span>
        <input required aria-required="true" aria-invalid={estado.tipo === "erro" || undefined} aria-describedby={estado.tipo === "erro" ? "lead-erro" : undefined} autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} className={campo} maxLength={120} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Telefone / WhatsApp <span className="text-red-600" aria-hidden>*</span></span>
        <input
          required
          aria-required="true"
          aria-describedby={estado.tipo === "erro" ? "lead-erro" : undefined}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 99999-9999"
          value={telefone}
          onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
          className={campo}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          E-mail <span className="font-normal text-slate-400">(opcional)</span>
        </span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} maxLength={150} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Mensagem <span className="font-normal text-slate-400">(opcional)</span>
        </span>
        <textarea
          rows={3}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={1000}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        />
      </label>

      {/* Armadilha para robos: invisivel para pessoas e leitores de tela. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Não preencha
          <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" required aria-required="true" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" />
        <span>
          Autorizo o contato e o uso dos meus dados conforme a{" "}
          <Link href={`${base}/privacidade`} target="_blank" className="font-medium text-blue-700 underline">
            política de privacidade
          </Link>
          .
        </span>
      </label>

      {estado.tipo === "erro" && (
        <div id="lead-erro" role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.mensagem}
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        {enviando ? "Enviando..." : "Quero ser contatado"}
      </button>
    </form>
  );
}
