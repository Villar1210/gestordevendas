// src/components/layout/Sidebar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  Kanban,
  MessageCircle,
  Users,
  Briefcase,
  FileSignature,
  Headset,
  type LucideIcon,
} from "lucide-react";
import { apiRequest } from "@/core/api/client";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  // Ausente = visivel para qualquer role. Presente = so aparece se o role
  // do usuario logado bater exatamente com este valor.
  requiredRole?: string;
}

// Array de navegacao: adicionar novos modulos aqui conforme o sistema cresce.
const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: "Inicio", href: "/dashboard/inicio" },
  { icon: Kanban, label: "Vendas", href: "/dashboard/kanban" },
  { icon: Building2, label: "Imoveis", href: "/dashboard/imoveis" },
  { icon: MessageCircle, label: "WhatsApp", href: "/dashboard/whatsapp" },
  { icon: FileSignature, label: "E-doc", href: "/dashboard/edoc" },
  { icon: Headset, label: "Atendimento", href: "/dashboard/atendimento" },
  { icon: Users, label: "Equipe", href: "/dashboard/equipe", requiredRole: "Administrador" },
  {
    icon: Briefcase,
    label: "RH",
    href: "/dashboard/rh/aprovacoes",
    requiredRole: "Administrador",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ role: string }>("/auth/me")
      .then((me) => setRole(me.role))
      .catch(() => setRole(null));
  }, []);

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.requiredRole || item.requiredRole === role);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      <div className="px-6 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Gestor de Vendas" className="h-10 w-auto" />
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {visibleNavItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
