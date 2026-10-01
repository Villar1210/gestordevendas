// src/features/cadastro-publico/components/CadastroRecebidoScreen.tsx
// Tela de confirmacao mostrada apos qualquer um dos 4 formularios de
// cadastro publico - a conta nasce pendente_aprovacao, entao nunca
// redireciona para o login. Mostra o que acontece a seguir, para a pessoa
// nao ficar sem saber se deu certo ou quando tera resposta.
import Link from "next/link";
import { CheckCircle2, Mail, ShieldCheck, LogIn, FileSignature } from "lucide-react";

// Prazo exibido ao candidato - texto unico, facil de ajustar.
export const PRAZO_ANALISE = "até 2 dias úteis";

export type PerfilCadastroRecebido = "cliente" | "corretor" | "imobiliaria";

interface Etapa {
  icone: typeof Mail;
  titulo: string;
  texto: string;
}

function etapasPara(perfil: PerfilCadastroRecebido): Etapa[] {
  const etapas: Etapa[] = [
    {
      icone: ShieldCheck,
      titulo: "Análise do cadastro",
      texto: `Nossa equipe confere os seus dados. Isso leva ${PRAZO_ANALISE}.`,
    },
    {
      icone: Mail,
      titulo: "Resposta por e-mail",
      texto: "Você recebe um e-mail avisando se o cadastro foi aprovado. Confira também a caixa de spam.",
    },
  ];
  if (perfil !== "cliente") {
    etapas.push({
      icone: FileSignature,
      titulo: "Contrato de parceria",
      texto: "Se aprovado, você recebe por e-mail o contrato de prestação de serviço para assinar online.",
    });
  }
  etapas.push({
    icone: LogIn,
    titulo: "Primeiro acesso",
    texto: "O e-mail de aprovação traz o botão de acesso. Entre com o e-mail e a senha que você acabou de criar.",
  });
  return etapas;
}

export function CadastroRecebidoScreen({ perfil = "cliente" }: { perfil?: PerfilCadastroRecebido }) {
  const etapas = etapasPara(perfil);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" aria-hidden />
          <h1 className="mb-2 text-xl font-semibold text-slate-800">Cadastro recebido!</h1>
          <p className="text-sm text-slate-500">Recebemos os seus dados. Veja o que acontece agora:</p>
        </div>

        <ol className="mt-6 space-y-4">
          {etapas.map((etapa, i) => {
            const Icone = etapa.icone;
            return (
              <li key={etapa.titulo} className="flex gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <Icone className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    <span className="sr-only">Etapa {i + 1}: </span>
                    {etapa.titulo}
                  </p>
                  <p className="text-sm text-slate-500">{etapa.texto}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-6 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Até a aprovação, o login fica bloqueado. Isso é normal.
        </p>

        <Link
          href="/login"
          className="mt-6 block rounded-lg bg-blue-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-800"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
