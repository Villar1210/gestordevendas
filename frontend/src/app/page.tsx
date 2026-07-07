// src/app/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TOKEN_STORAGE_KEY } from "@/core/api/client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    router.replace(token ? "/dashboard/kanban" : "/login");
  }, [router]);

  return null;
}
