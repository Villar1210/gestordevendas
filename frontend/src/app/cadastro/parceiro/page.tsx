// src/app/cadastro/parceiro/page.tsx
"use client";

import Link from "next/link";
import { UserSquare2, Building2 } from "lucide-react";

const OPCOES = [
  {
    href: "/cadastro/parceiro/corretor",
    icon: UserSquare2,
    title: "Corretor Parceiro",
    description: "Sou corretor autonomo de outra imobiliaria e quero indicar clientes.",
  },
  {
    href: "/cadastro/parceiro/imobiliaria",
    icon: Building2,
    title: "Imobiliaria Parceira",
    description: "Represento uma imobiliaria externa (CNPJ/CRECI-J).",
  },
];

export default function CadastroParceiroPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Gestor de Vendas" className="mx-auto mb-4 w-[200px]" />
          <p className="text-sm text-slate-500">Voce e...</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {OPCOES.map((opcao) => {
            const Icon = opcao.icon;
            return (
              <Link
                key={opcao.href}
                href={opcao.href}
                className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold text-slate-800">{opcao.title}</span>
                <span className="text-sm text-slate-500">{opcao.description}</span>
              </Link>
            );
          })}
        </div>

        <Link href="/cadastro" className="mt-8 block text-center text-sm text-blue-600 hover:underline">
          Voltar
        </Link>
      </div>
    </div>
  );
}
