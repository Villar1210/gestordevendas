// src/components/layout/Topbar.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { apiRequest, TOKEN_STORAGE_KEY } from "@/core/api/client";

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function Topbar() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    apiRequest<Me>("/auth/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  function handleLogout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    router.push("/login");
  }

  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b border-slate-200 bg-white px-6">
      {me && (
        <div className="text-right leading-tight">
          <p className="text-sm font-medium text-slate-800">{me.name}</p>
          <p className="text-xs text-slate-500">{me.email}</p>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </header>
  );
}
