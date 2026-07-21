// src/app/dashboard/redes-sociais/page.tsx
// Fatia 2a: conexao OAuth com Paginas do Facebook/Instagram Business via
// Meta Graph API - a tela de "Modulo em construcao" da Fatia 1 vira a
// tela de "Contas conectadas". Compositor, calendario e publicacao de
// posts continuam em fatias futuras.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { ContasConectadasCard } from "@/features/social-media/components/ContasConectadasCard";

// Mensagens de retorno do fluxo OAuth (GET /social/callback, no backend,
// redireciona de volta pra ca com esses parametros na URL - ver
// SocialController.callback). Espelhado aqui so para exibicao amigavel;
// os valores de "motivo" sao os mesmos que o backend gera.
const MOTIVO_LABELS: Record<string, string> = {
  parametros_ausentes: "A Meta nao retornou os parametros esperados.",
  state_invalido: "A sessao de conexao expirou ou e invalida. Tente novamente.",
  falha_conexao: "Nao foi possivel concluir a conexao com a Meta. Tente novamente.",
};

export default function RedesSociaisPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "sucesso" | "erro" | "info"; mensagem: string } | null>(
    null,
  );
  const hasHandledQuery = useRef(false);

  useEffect(() => {
    apiRequest<{ role: string }>("/auth/me")
      .then((me) => setRole(me.role))
      .catch(() => setRole(null))
      .finally(() => setRoleChecked(true));
  }, []);

  useEffect(() => {
    if (hasHandledQuery.current) return;
    hasHandledQuery.current = true;

    // Le direto de window.location (nao useSearchParams, que exigiria
    // envolver a pagina numa Suspense boundary so por causa disso - mesmo
    // padrao ja usado em /dashboard/kanban).
    const params = new URLSearchParams(window.location.search);
    const social = params.get("social");
    if (!social) return;

    if (social === "sucesso") {
      const contas = params.get("contas") ?? "0";
      setFeedback({ tipo: "sucesso", mensagem: `${contas} conta(s) conectada(s) com sucesso.` });
    } else if (social === "cancelado") {
      setFeedback({ tipo: "info", mensagem: "Conexao cancelada." });
    } else if (social === "erro") {
      const motivo = params.get("motivo") ?? "";
      setFeedback({
        tipo: "erro",
        mensagem: MOTIVO_LABELS[motivo] ?? "Nao foi possivel concluir a conexao.",
      });
    }

    // Limpa os parametros da URL depois de ler, sem adicionar uma entrada
    // nova no historico (evita reabrir o mesmo aviso se o usuario der F5).
    router.replace("/dashboard/redes-sociais");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!roleChecked) {
    return null;
  }

  if (role !== "Administrador") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="rounded-full bg-blue-50 p-4">
          <Share2 className="h-8 w-8 text-blue-600" />
        </div>
        <h1 className="text-xl font-semibold text-slate-800">Redes Sociais</h1>
        <p className="max-w-md text-sm text-slate-500">
          Este recurso e restrito ao Administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">Redes Sociais</h1>
      <p className="mb-6 text-sm text-slate-500">
        Conecte contas do Instagram e Facebook para agendar e publicar posts diretamente pelo
        gestordevendas.
      </p>

      {feedback && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            feedback.tipo === "sucesso"
              ? "bg-green-50 text-green-700"
              : feedback.tipo === "erro"
                ? "bg-red-50 text-red-700"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {feedback.mensagem}
        </div>
      )}

      <ContasConectadasCard />
    </div>
  );
}
