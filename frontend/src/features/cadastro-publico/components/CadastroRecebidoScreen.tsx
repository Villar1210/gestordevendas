// src/features/cadastro-publico/components/CadastroRecebidoScreen.tsx
// Tela de confirmacao mostrada apos qualquer um dos 4 formularios de
// cadastro publico - a conta nasce pendente_aprovacao, entao nunca
// redireciona para o login.
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export function CadastroRecebidoScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
        <h1 className="mb-2 text-xl font-semibold text-slate-800">Cadastro recebido!</h1>
        <p className="mb-6 text-sm text-slate-500">
          Nossa equipe vai analisar e entrar em contato em breve.
        </p>
        <Link
          href="/login"
          className="block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
