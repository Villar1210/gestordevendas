import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        // Origem dos leads
        "origem-manual": "rgb(148 163 184)", // slate-400
        "origem-webhook": "rgb(37 99 235)", // blue-600
        "origem-roleta": "rgb(147 51 234)", // purple-600
        "origem-vivi": "rgb(13 148 136)", // teal-600

        // Temperatura/urgência
        "temp-quente": "rgb(239 68 68)", // red-500
        "temp-morno": "rgb(217 119 6)", // amber-600
        "temp-frio": "rgb(3 105 161)", // sky-700

        // Estados especiais
        "rotting-warn": "rgb(180 83 9)", // amber-700
        "rotting-crit": "rgb(185 28 28)", // red-700
        "activity-future": "rgb(37 99 235)", // blue-600
        "activity-overdue": "rgb(220 38 38)", // red-600

        // Estágios por índice (paleta neutra-progressiva)
        "stage-0": "rgb(79 90 102)", // slate-600
        "stage-1": "rgb(59 130 246)", // blue-500
        "stage-2": "rgb(79 70 229)", // indigo-600
        "stage-3": "rgb(147 51 234)", // purple-600
        "stage-4": "rgb(59 130 246)", // blue-500 (repete)

        // Estágios protegidos
        "stage-fechamento": "rgb(5 150 105)", // emerald-600
        "stage-repique": "rgb(217 119 6)", // amber-600
      },
    },
  },
  plugins: [],
};

export default config;
