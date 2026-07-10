// src/app/cadastro/page.tsx
"use client";

import Link from "next/link";
import { User, Briefcase, Users } from "lucide-react";

const PERFIS = [
  {
    href: "/cadastro/cliente",
    icon: User,
    title: "Cliente",
    description: "Busco imoveis para comprar, alugar ou quero anunciar o meu.",
  },
  {
    href: "/cadastro/corretor",
    icon: Briefcase,
    title: "Corretor de Imoveis",
    description: "Sou profissional autonomo e quero ser corretor da equipe.",
  },
  {
    href: "/cadastro/parceiro",
    icon: Users,
    title: "Parceiro",
    description: "Sou corretor de outra imobiliaria ou represento uma imobiliaria.",
  },
];

export default function CadastroPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-1 text-xl font-semibold text-slate-800">gestordevendas</h1>
          <p className="text-sm text-slate-500">Criar Cadastro - escolha o perfil que combina com voce</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {PERFIS.map((perfil) => {
            const Icon = perfil.icon;
            return (
              <Link
                key={perfil.href}
                href={perfil.href}
                className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-amber-300 hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold text-slate-800">{perfil.title}</span>
                <span className="text-sm text-slate-500">{perfil.description}</span>
              </Link>
            );
          })}
        </div>

        <Link
          href="/login"
          className="mt-8 block text-center text-sm text-amber-600 hover:underline"
        >
          Ja tenho uma conta - fazer login
        </Link>
      </div>
    </div>
  );
}
