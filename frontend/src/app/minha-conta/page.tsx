// src/app/minha-conta/page.tsx
// Portal do Cliente - destino pos-login para roles sem acesso ao dashboard
// interno (Cliente, Imobiliaria Parceira) - ver DASHBOARD_ROLES. Pagina
// fora do layout do dashboard (sem Sidebar/Topbar), com cabecalho proprio
// simples. As secoes exibidas dependem de tipoCliente (comprador/
// proprietario/ambos - so relevante para o Role Cliente); Assinaturas
// Pendentes e Meus Documentos aparecem sempre, para qualquer role que
// caia aqui.
//
// LIMITACAO CONHECIDA: os dados de cada secao sao encontrados por
// CORRESPONDENCIA DE E-MAIL (User.email == Proprietario.email /
// Card.email / SignatureRecipient.email), nao por vinculo formal (FK).
// Se o cliente usar um e-mail diferente do cadastrado no contrato, card
// ou envelope, a secao correspondente aparecera vazia - isso e uma
// limitacao conhecida, nao um bug. Ver CLAUDE.md.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Headset,
  FileSignature,
  FileCheck2,
  LogOut,
  Loader2,
  MapPin,
} from "lucide-react";
import {
  apiRequest,
  ApiError,
  API_BASE_URL,
  TOKEN_STORAGE_KEY,
  STATUS_DISPONIBILIDADE_STORAGE_KEY,
} from "@/core/api/client";

interface MeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tipoCliente: string | null;
}

interface MeuImovel {
  contratoId: string;
  contratoTipo: string;
  contratoStatus: string;
  imovelId: string;
  imovelTitle: string;
  imovelEndereco: string;
  imovelStatus: string;
  coverPhotoUrl: string | null;
}

interface MeuAtendimento {
  cardId: string;
  title: string;
  stageName: string | null;
  ownerName: string | null;
}

interface AssinaturaPendente {
  envelopeId: string;
  envelopeTitle: string;
  accessToken: string;
}

interface DocumentoAssinado {
  envelopeId: string;
  envelopeTitle: string;
  signedDocumentUrl: string | null;
}

const CONTRATO_STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

const CONTRATO_STATUS_BADGE: Record<string, string> = {
  ativo: "bg-green-100 text-green-700",
  encerrado: "bg-slate-100 text-slate-700",
  cancelado: "bg-red-100 text-red-700",
};

// Traduz o nome tecnico da stage (livre, definido por tenant) para uma
// linguagem mais amigavel ao cliente final - so cobre as stages padrao
// criadas pelo CreateDefaultPipelineUseCase; qualquer outra stage
// (renomeada ou criada manualmente pelo tenant) cai no fallback (nome cru).
const STAGE_FRIENDLY_LABELS: Record<string, string> = {
  "Em Atendimento": "Em atendimento",
  Qualificacao: "Em qualificacao",
  "Analise de Credito": "Em analise de credito",
  Negociacao: "Em negociacao",
  Fechamento: "Fechamento",
};

function getStageFriendlyLabel(stageName: string | null): string {
  if (!stageName) return "Novo contato, aguardando atendimento";
  return STAGE_FRIENDLY_LABELS[stageName] ?? stageName;
}

export default function MinhaContaPage() {
  const router = useRouter();
  const hasInitialized = useRef(false);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MeUser | null>(null);
  const [meusImoveis, setMeusImoveis] = useState<MeuImovel[]>([]);
  const [meuAtendimento, setMeuAtendimento] = useState<MeuAtendimento[]>([]);
  const [assinaturasPendentes, setAssinaturasPendentes] = useState<AssinaturaPendente[]>([]);
  const [documentosAssinados, setDocumentosAssinados] = useState<DocumentoAssinado[]>([]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    async function loadAll() {
      try {
        const [me, imoveis, atendimento, pendentes, documentos] = await Promise.all([
          apiRequest<MeUser>("/auth/me"),
          apiRequest<MeuImovel[]>("/portal/meus-imoveis"),
          apiRequest<MeuAtendimento[]>("/portal/meu-atendimento"),
          apiRequest<AssinaturaPendente[]>("/portal/assinaturas-pendentes"),
          apiRequest<DocumentoAssinado[]>("/portal/documentos-assinados"),
        ]);
        setUser(me);
        setMeusImoveis(imoveis);
        setMeuAtendimento(atendimento);
        setAssinaturasPendentes(pendentes);
        setDocumentosAssinados(documentos);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [router]);

  function handleLogout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STATUS_DISPONIBILIDADE_STORAGE_KEY);
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando sua conta...</p>
      </div>
    );
  }

  if (!user) return null;

  const tipoCliente = user.tipoCliente ?? "";
  const mostrarImoveis = tipoCliente.includes("proprietario");
  const mostrarAtendimento = tipoCliente.includes("comprador");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <span className="text-lg font-semibold text-slate-800">gestordevendas</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">Ola, {user.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 p-6">
        {mostrarImoveis && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
              <Home className="h-5 w-5 text-blue-600" />
              Meus Imoveis
            </h2>
            {meusImoveis.length === 0 ? (
              <EmptyState message="Voce ainda nao tem imoveis cadastrados." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {meusImoveis.map((item) => (
                  <div
                    key={item.contratoId}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex h-32 items-center justify-center bg-slate-100">
                      {item.coverPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${API_BASE_URL}${item.coverPhotoUrl}`}
                          alt={item.imovelTitle}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Home className="h-8 w-8 text-slate-300" />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800">{item.imovelTitle}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            CONTRATO_STATUS_BADGE[item.contratoStatus] ??
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {CONTRATO_STATUS_LABELS[item.contratoStatus] ?? item.contratoStatus}
                        </span>
                      </div>
                      {item.imovelEndereco && (
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {item.imovelEndereco}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {mostrarAtendimento && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
              <Headset className="h-5 w-5 text-blue-600" />
              Meu Atendimento
            </h2>
            {meuAtendimento.length === 0 ? (
              <EmptyState message="Voce ainda nao tem nenhum atendimento em andamento." />
            ) : (
              <div className="space-y-3">
                {meuAtendimento.map((item) => (
                  <div
                    key={item.cardId}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <p className="mb-1 text-sm font-medium text-slate-800">{item.title}</p>
                    <p className="text-sm text-blue-700">{getStageFriendlyLabel(item.stageName)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.ownerName
                        ? `Corretor responsavel: ${item.ownerName}`
                        : "Ainda sem corretor responsavel definido."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
            <FileSignature className="h-5 w-5 text-blue-600" />
            Assinaturas Pendentes
          </h2>
          {assinaturasPendentes.length === 0 ? (
            <EmptyState message="Voce nao tem nenhuma assinatura pendente no momento." />
          ) : (
            <div className="space-y-3">
              {assinaturasPendentes.map((item) => (
                <div
                  key={item.envelopeId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-sm font-medium text-slate-800">{item.envelopeTitle}</p>
                  <a
                    href={`/assinar/${item.accessToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                  >
                    Assinar agora
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
            <FileCheck2 className="h-5 w-5 text-blue-600" />
            Meus Documentos
          </h2>
          {documentosAssinados.length === 0 ? (
            <EmptyState message="Voce ainda nao tem documentos assinados." />
          ) : (
            <div className="space-y-3">
              {documentosAssinados.map((item) => (
                <div
                  key={item.envelopeId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-sm font-medium text-slate-800">{item.envelopeTitle}</p>
                  {item.signedDocumentUrl ? (
                    <a
                      href={`${API_BASE_URL}${item.signedDocumentUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                    >
                      Baixar
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-400">Gerando PDF...</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}
