// src/app/dashboard/edoc/[id]/page.tsx
"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, FileSignature } from "lucide-react";
import { API_BASE_URL } from "@/core/api/client";
import { useEdocIntegration } from "@/features/edoc/hooks/useEdocIntegration";
import { Envelope, EnvelopeRecipient } from "@/features/edoc/store/useEdocStore";
import { getStatusOption } from "@/features/edoc/constants";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function EnvelopeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { handleGetEnvelopeDetail } = useEdocIntegration();

  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [recipients, setRecipients] = useState<EnvelopeRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    handleGetEnvelopeDetail(id)
      .then((result) => {
        if (result) {
          setEnvelope(result.envelope);
          setRecipients(result.recipients);
        }
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando envelope...</p>
      </div>
    );
  }

  if (!envelope) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">
        <FileSignature className="h-8 w-8" />
        <p className="text-sm">Envelope nao encontrado.</p>
      </div>
    );
  }

  const statusOption = getStatusOption(envelope.status);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/edoc"
            className="text-slate-400 hover:text-slate-600"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">{envelope.title}</h1>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusOption.badgeClassName}`}
            >
              {statusOption.label}
            </span>
          </div>
        </div>

        {envelope.status === "concluido" && envelope.signedDocumentUrl && (
          <a
            href={`${API_BASE_URL}${envelope.signedDocumentUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Download className="h-4 w-4" /> Baixar documento assinado
          </a>
        )}
      </header>

      <div className="p-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Ordem</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assinado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recipients.map((recipient) => (
                <tr key={recipient.id}>
                  <td className="px-4 py-3 text-slate-500">{recipient.order}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{recipient.name}</td>
                  <td className="px-4 py-3 text-slate-500">{recipient.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        recipient.status === "assinado"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {recipient.status === "assinado" ? "Assinado" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {recipient.signedAt ? dateFormatter.format(new Date(recipient.signedAt)) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {envelope.status === "concluido" && !envelope.signedDocumentUrl && (
          <p className="mt-4 text-sm text-slate-400">
            O documento foi concluido, mas o PDF final ainda esta sendo gerado. Atualize a pagina
            em instantes.
          </p>
        )}
      </div>
    </div>
  );
}
