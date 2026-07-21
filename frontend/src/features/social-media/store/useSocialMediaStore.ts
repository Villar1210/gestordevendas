// src/features/social-media/store/useSocialMediaStore.ts
import { create } from "zustand";

export interface SocialAccount {
  id: string;
  canal: string;
  accountName: string;
  status: string;
  tokenExpiresAt: string | null;
  createdAt: string;
}

interface SocialMediaState {
  contas: SocialAccount[];
  isLoading: boolean;
  isConectando: boolean;

  setContas: (contas: SocialAccount[]) => void;
  setLoading: (isLoading: boolean) => void;
  setConectando: (isConectando: boolean) => void;
}

export const useSocialMediaStore = create<SocialMediaState>((set) => ({
  contas: [],
  isLoading: false,
  isConectando: false,

  setContas: (contas) => set({ contas }),
  setLoading: (isLoading) => set({ isLoading }),
  setConectando: (isConectando) => set({ isConectando }),
}));
