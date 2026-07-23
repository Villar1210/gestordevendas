// src/features/imoveis/components/EspelhoDeVendas.tsx
"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/core/api/client";
import { useImoveisStore, Imovel, EmpreendimentoPhoto } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import {
  STATUS_OPTIONS,
  getStatusOption,
  EMPREENDIMENTO_PHOTO_CATEGORIA_OPTIONS,
  getEmpreendimentoPhotoCategoriaLabel,
} from "../constants";
import { StatusPopover } from "./StatusPopover";

export function EspelhoDeVendas() {
  // Fatia 4: o Espelho de Vendas so lista empreendimentos ja publicados -
  // usa "empreendimentosPublicados" (GET /empreendimentos?publicado=true,
  // filtrado no backend), NUNCA "empreendimentos" (lista completa, usada
  // pelo Catalogo/Cadastro em Lote, que precisam ver tambem os pendentes
  // de revisao). Refeito a cada vez que este componente monta (troca de
  // aba), o que tambem resolve o caso de um empreendimento ser publicado/
  // despublicado em outra tela e o usuario voltar para o Espelho depois.
  const empreendimentosPublicados = useImoveisStore((state) => state.empreendimentosPublicados);
  const espelhoEmpreendimentoId = useImoveisStore((state) => state.espelhoEmpreendimentoId);
  const setEspelhoEmpreendimentoId = useImoveisStore((state) => state.setEspelhoEmpreendimentoId);
  const {
    loadEmpreendimentosPublicados,
    handleListImoveisByEmpreendimento,
    handleUpdateImovel,
    handleGetEmpreendimentoDetail,
  } = useImoveisIntegration();

  const [unidades, setUnidades] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(false);
  const [openPopoverFor, setOpenPopoverFor] = useState<string | null>(null);
  // Fatia 5 - fotos de planta/area comum do empreendimento selecionado,
  // mostradas numa secao SEPARADA do grid de status das unidades abaixo
  // (decisao alinhada: nao misturar no mesmo carrossel/grid).
  const [empreendimentoPhotos, setEmpreendimentoPhotos] = useState<EmpreendimentoPhoto[]>([]);

  useEffect(() => {
    loadEmpreendimentosPublicados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const aindaValido =
      espelhoEmpreendimentoId &&
      empreendimentosPublicados.some((emp) => emp.id === espelhoEmpreendimentoId);

    if (aindaValido) return;

    setEspelhoEmpreendimentoId(
      empreendimentosPublicados.length > 0 ? empreendimentosPublicados[0].id : null,
    );
  }, [empreendimentosPublicados, espelhoEmpreendimentoId, setEspelhoEmpreendimentoId]);

  useEffect(() => {
    if (!espelhoEmpreendimentoId) {
      setUnidades([]);
      return;
    }
    setLoading(true);
    handleListImoveisByEmpreendimento(espelhoEmpreendimentoId)
      .then(setUnidades)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espelhoEmpreendimentoId]);

  useEffect(() => {
    if (!espelhoEmpreendimentoId) {
      setEmpreendimentoPhotos([]);
      return;
    }
    handleGetEmpreendimentoDetail(espelhoEmpreendimentoId)
      .then((detail) => setEmpreendimentoPhotos(detail.photos))
      .catch(() => setEmpreendimentoPhotos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espelhoEmpreendimentoId]);

  async function handleChangeStatus(imovelId: string, status: string) {
    setOpenPopoverFor(null);
    const updated = await handleUpdateImovel(imovelId, { status });
    if (updated) {
      setUnidades((prev) => prev.map((u) => (u.id === imovelId ? { ...u, status } : u)));
    }
  }

  return (
    <div className="px-6 py-4">
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-slate-500">Empreendimento</label>
        <select
          value={espelhoEmpreendimentoId ?? ""}
          onChange={(e) => setEspelhoEmpreendimentoId(e.target.value || null)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        >
          {empreendimentosPublicados.length === 0 && (
            <option value="">Nenhum empreendimento publicado ainda</option>
          )}
          {empreendimentosPublicados.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </div>

      {/* Fotos de planta/area comum do empreendimento (Fatia 5) - secao
          SEPARADA do grid de status das unidades abaixo, de proposito (nao
          misturar fotos de area comum com o carrossel/grid de unidades). */}
      {empreendimentoPhotos.length > 0 && (
        <div className="mb-6 space-y-4">
          {EMPREENDIMENTO_PHOTO_CATEGORIA_OPTIONS.map((categoriaOption) => {
            const fotosDaCategoria = empreendimentoPhotos.filter(
              (photo) => photo.categoria === categoriaOption.value,
            );
            if (fotosDaCategoria.length === 0) return null;
            return (
              <div key={categoriaOption.value}>
                <h3 className="mb-2 text-xs font-medium uppercase text-slate-500">
                  {getEmpreendimentoPhotoCategoriaLabel(categoriaOption.value)}
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {fotosDaCategoria.map((photo) => (
                    <div
                      key={photo.id}
                      className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${API_BASE_URL}${photo.url}`}
                        alt={categoriaOption.label}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        {STATUS_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-3 w-3 rounded ${opt.solidClassName}`} />
            {opt.label}
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando unidades...</p>
      ) : unidades.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nenhuma unidade cadastrada neste empreendimento.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {unidades.map((unidade) => {
            const statusOption = getStatusOption(unidade.status);
            return (
              <div key={unidade.id} className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenPopoverFor(openPopoverFor === unidade.id ? null : unidade.id)
                  }
                  className={`flex aspect-square w-full flex-col items-center justify-center rounded-lg p-2 text-center text-xs font-medium leading-tight text-white shadow-sm transition hover:opacity-90 ${statusOption.solidClassName}`}
                  title={statusOption.label}
                >
                  <span className="line-clamp-2">{unidade.codigoInterno || unidade.title}</span>
                </button>

                {openPopoverFor === unidade.id && (
                  <StatusPopover
                    onSelect={(status) => handleChangeStatus(unidade.id, status)}
                    onClose={() => setOpenPopoverFor(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
