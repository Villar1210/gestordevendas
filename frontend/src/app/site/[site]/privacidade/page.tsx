// src/app/site/[site]/privacidade/page.tsx
// Texto-base de privacidade (LGPD). E um MODELO generico: a empresa deve
// revisar com o juridico antes de considerar definitivo.
import type { Metadata } from "next";
import { resolverSite } from "@/features/site-publico/server-api";

export const metadata: Metadata = { title: "Política de privacidade" };

export default async function PrivacidadePage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const { nome } = await resolverSite(site);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Política de privacidade</h1>
      <p className="mt-4">
        Esta página explica como <strong>{nome}</strong> trata os dados pessoais enviados pelo formulário de contato
        deste site, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Quais dados coletamos</h2>
      <p className="mt-2">
        Nome, telefone, e-mail (opcional), a mensagem que você escrever e o imóvel ou empreendimento de interesse.
        Também registramos data e hora do envio para segurança do serviço.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Para que usamos</h2>
      <p className="mt-2">
        Exclusivamente para retornar o seu contato e apresentar imóveis compatíveis com o que você procura. A base
        legal é o seu consentimento, dado ao marcar a caixa de autorização no formulário.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Com quem compartilhamos</h2>
      <p className="mt-2">
        Seus dados ficam disponíveis apenas para a equipe comercial de {nome} e para os fornecedores de tecnologia
        que hospedam este site e o sistema de atendimento. Não vendemos dados pessoais.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Por quanto tempo guardamos</h2>
      <p className="mt-2">
        Enquanto houver relacionamento comercial ou até você pedir a exclusão, respeitados os prazos exigidos por lei.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Seus direitos</h2>
      <p className="mt-2">
        Você pode pedir a qualquer momento: confirmação de que tratamos seus dados, acesso, correção, exclusão ou a
        revogação do consentimento. Basta responder ao contato que recebeu da nossa equipe ou falar com um de nossos
        corretores.
      </p>

      <p className="mt-10 text-sm text-slate-500">Última atualização: setembro de 2026.</p>
    </article>
  );
}
