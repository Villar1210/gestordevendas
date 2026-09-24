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
  Share2,
  Calculator,
  Settings,
  X,
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
  { icon: Share2, label: "Redes Sociais", href: "/dashboard/redes-sociais" },
  { icon: Users, label: "Equipe", href: "/dashboard/equipe", requiredRole: "Administrador" },
  {
    icon: Briefcase,
    label: "RH",
    href: "/dashboard/rh/aprovacoes",
    requiredRole: "Administrador",
  },
  {
    icon: Calculator,
    label: "Simulador",
    href: "/dashboard/simulador-credito",
    requiredRole: "Administrador",
  },
  // Atalho para o Painel de Configuracao (VIVI, cargos, e-mail, stands),
  // que continua sendo a 3a aba de RH. A rota /dashboard/configuracoes
  // ja redireciona para la.
  {
    icon: Settings,
    label: "Configurações",
    href: "/dashboard/configuracoes",
    requiredRole: "Administrador",
  },
];

interface SidebarProps {
  // Controla a gaveta no celular. No desktop (md+) o menu fica sempre visivel.
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  // Fecha a gaveta ao trocar de pagina (celular).
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Esc fecha a gaveta.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    apiRequest<{ role: string }>("/auth/me")
      .then((me) => setRole(me.role))
      .catch(() => setRole(null));
  }, []);

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.requiredRole || item.requiredRole === role);

  return (
    <>
      {/* Fundo escuro atras da gaveta (so no celular, com o menu aberto) */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="menu-principal"
        aria-label="Menu principal"
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:static md:z-auto md:w-60 md:translate-x-0 ${
          open ? "translate-x-0 shadow-xl" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Gestor de Vendas" className="h-10 w-auto" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto px-3 pb-4">
          {visibleNavItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition md:py-2 ${
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
    </>
  );
}
