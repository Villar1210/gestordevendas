// src/features/imoveis/components/ImovelDetailPanel.tsx
"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { API_BASE_URL } from "@/core/api/client";
import { ImovelPhoto, useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import {
  FINALIDADE_OPTIONS,
  LOCAL_CHAVES_OPTIONS,
  STATUS_OPTIONS,
  TIPO_OPTIONS,
  USO_OPTIONS,
} from "../constants";

function toDateInputValue(isoDate: string | null): string {
  if (!isoDate) return "";
  return isoDate.slice(0, 10);
}

export function ImovelDetailPanel() {
  const imovelDetailPanel = useImoveisStore((state) => state.imovelDetailPanel);
  const closeImovelDetailPanel = useImoveisStore((state) => state.closeImovelDetailPanel);
  const updateImovelInPlace = useImoveisStore((state) => state.updateImovelInPlace);
  const { handleGetImovel, handleUpdateImovel, handleUploadPhoto, handleDeletePhoto } =
    useImoveisIntegration();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ImovelPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [codigoInterno, setCodigoInterno] = useState("");
  const [title, setTitle] = useState("");
  const [tipo, setTipo] = useState("");
  const [uso, setUso] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [tags, setTags] = useState("");

  const [status, setStatus] = useState("");
  const [disponivelApartirDe, setDisponivelApartirDe] = useState("");
  const [localChaves, setLocalChaves] = useState("");
  const [exclusividade, setExclusividade] = useState(false);

  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [cep, setCep] = useState("");

  const [proprietarioNome, setProprietarioNome] = useState("");
  const [proprietarioTelefone, setProprietarioTelefone] = useState("");

  const [price, setPrice] = useState("");
  const [rentPrice, setRentPrice] = useState("");
  const [area, setArea] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [parkingSpots, setParkingSpots] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);

  const imovel = imovelDetailPanel.imovel;

  useEffect(() => {
    if (!imovelDetailPanel.isOpen || !imovel) return;

    setPhotos(imovel.photos ?? []);
    setCodigoInterno(imovel.codigoInterno ?? "");
    setTitle(imovel.title);
    setTipo(imovel.tipo);
    setUso(imovel.uso ?? "");
    setFinalidade(imovel.finalidade);
    setTags(imovel.tags ?? "");
    setStatus(imovel.status);
    setDisponivelApartirDe(toDateInputValue(imovel.disponivelApartirDe));
    setLocalChaves(imovel.localChaves ?? "");
    setExclusividade(imovel.exclusividade);
    setRua(imovel.rua ?? "");
    setNumero(imovel.numero ?? "");
    setComplemento(imovel.complemento ?? "");
    setBairro(imovel.bairro ?? "");
    setCidade(imovel.cidade ?? "");
    setUf(imovel.uf ?? "");
    setCep(imovel.cep ?? "");
    setProprietarioNome(imovel.proprietarioNome ?? "");
    setProprietarioTelefone(imovel.proprietarioTelefone ?? "");
    setPrice(imovel.price ? String(imovel.price) : "");
    setRentPrice(imovel.rentPrice ? String(imovel.rentPrice) : "");
    setArea(imovel.area ? String(imovel.area) : "");
    setBedrooms(imovel.bedrooms ? String(imovel.bedrooms) : "");
    setBathrooms(imovel.bathrooms ? String(imovel.bathrooms) : "");
    setParkingSpots(imovel.parkingSpots ? String(imovel.parkingSpots) : "");
    setDescription(imovel.description ?? "");

    // Recarrega do backend para garantir que a galeria de fotos esta atualizada
    // (a lista do Catalogo so traz a foto de capa, nao a galeria completa).
    handleGetImovel(imovel.id).then((fresh) => {
      if (fresh?.photos) setPhotos(fresh.photos);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imovelDetailPanel.isOpen, imovel?.id]);

  if (!imovelDetailPanel.isOpen || !imovel) return null;

  async function handleAddPhotoClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !imovel) return;

    setUploadingPhoto(true);
    try {
      const photo = await handleUploadPhoto(imovel.id, file);
      if (photo) {
        setPhotos((prev) => {
          const next = [...prev, photo];
          // Mantem a foto de capa do Catalogo em sincronia sem precisar recarregar a lista.
          updateImovelInPlace({ ...imovel, coverPhotoUrl: next[0].url });
          return next;
        });
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto(photoId: string) {
    if (!imovel) return;
    const ok = await handleDeletePhoto(imovel.id, photoId);
    if (ok) {
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== photoId);
        updateImovelInPlace({ ...imovel, coverPhotoUrl: next[0]?.url ?? null });
        return next;
      });
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!imovel) return;
    setSaving(true);
    try {
      await handleUpdateImovel(imovel.id, {
        codigoInterno: codigoInterno.trim() || undefined,
        title,
        tipo,
        uso: uso || undefined,
        finalidade,
        tags: tags.trim() || undefined,
        status,
        disponivelApartirDe: disponivelApartirDe || undefined,
        localChaves: localChaves || undefined,
        exclusividade,
        rua: rua.trim() || undefined,
        numero: numero.trim() || undefined,
        complemento: complemento.trim() || undefined,
        bairro: bairro.trim() || undefined,
        cidade: cidade.trim() || undefined,
        uf: uf.trim() || undefined,
        cep: cep.trim() || undefined,
        proprietarioNome: proprietarioNome.trim() || undefined,
        proprietarioTelefone: proprietarioTelefone.trim() || undefined,
        price: price ? Number(price) : undefined,
        rentPrice: rentPrice ? Number(rentPrice) : undefined,
        area: area ? Number(area) : undefined,
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        parkingSpots: parkingSpots ? Number(parkingSpots) : undefined,
        description: description.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes do Imovel"
      onClick={closeImovelDetailPanel}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-800">{imovel.title}</h2>
          <button
            onClick={closeImovelDetailPanel}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-8">
            {/* Galeria de fotos */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Fotos</h3>
              <div className="flex flex-wrap gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${API_BASE_URL}${photo.url}`}
                      alt="Foto do imovel"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block"
                      aria-label="Remover foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddPhotoClick}
                  disabled={uploadingPhoto}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs">{uploadingPhoto ? "Enviando..." : "Adicionar"}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelected}
                />
              </div>
            </section>

            {/* Informacoes Basicas */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Informacoes Basicas</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Codigo interno</label>
                    <input
                      type="text"
                      placeholder="ex: AP-101"
                      value={codigoInterno}
                      onChange={(e) => setCodigoInterno(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Titulo</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Tipo</label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    >
                      {TIPO_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Uso</label>
                    <select
                      value={uso}
                      onChange={(e) => setUso(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    >
                      <option value="">Nao definido</option>
                      {USO_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Finalidade</label>
                    <select
                      value={finalidade}
                      onChange={(e) => setFinalidade(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    >
                      {FINALIDADE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-500">
                    Tags (separadas por virgula)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="ex: piscina, vista mar, mobiliado"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </section>

            {/* Situacao e Chaves */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Situacao e Chaves</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">
                      Disponivel a partir de
                    </label>
                    <input
                      type="date"
                      value={disponivelApartirDe}
                      onChange={(e) => setDisponivelApartirDe(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm text-slate-500">Local das chaves</label>
                    <select
                      value={localChaves}
                      onChange={(e) => setLocalChaves(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    >
                      <option value="">Nao definido</option>
                      {LOCAL_CHAVES_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={exclusividade}
                      onChange={(e) => setExclusividade(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    Exclusividade
                  </label>
                </div>
              </div>
            </section>

            {/* Localizacao */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Localizacao</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Rua"
                    value={rua}
                    onChange={(e) => setRua(e.target.value)}
                    className="w-2/3 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                  <input
                    type="text"
                    placeholder="Numero"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className="w-1/3 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Complemento"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
                <input
                  type="text"
                  placeholder="Bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="UF"
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    className="w-1/4 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                  <input
                    type="text"
                    placeholder="CEP"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                    className="w-1/4 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </section>

            {/* Proprietario */}
            <section>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Proprietario</h3>
              <p className="mb-3 text-xs text-slate-400">
                Cadastro completo de proprietarios em breve.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nome"
                  value={proprietarioNome}
                  onChange={(e) => setProprietarioNome(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
                <input
                  type="text"
                  placeholder="Telefone"
                  value={proprietarioTelefone}
                  onChange={(e) => setProprietarioTelefone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </section>

            {/* Detalhes */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Detalhes</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Preco de venda (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Aluguel (R$/mes)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rentPrice}
                      onChange={(e) => setRentPrice(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Area (m²)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Quartos</label>
                    <input
                      type="number"
                      min="0"
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Banheiros</label>
                    <input
                      type="number"
                      min="0"
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Vagas</label>
                    <input
                      type="number"
                      min="0"
                      value={parkingSpots}
                      onChange={(e) => setParkingSpots(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-500">Descricao</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </section>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
