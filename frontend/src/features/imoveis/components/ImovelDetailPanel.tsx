// src/features/imoveis/components/ImovelDetailPanel.tsx
"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { ArrowLeft, ArrowRight, Plus, X, ChevronLeft, ChevronRight, Bed, Bath, Car, Maximize2, MapPin, Tag, ExternalLink, CheckCircle2 } from "lucide-react";
import { API_BASE_URL } from "@/core/api/client";
import { ImovelPhoto, useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import {
  FINALIDADE_OPTIONS,
  LOCAL_CHAVES_OPTIONS,
  STATUS_OPTIONS,
  TIPO_OPTIONS,
  USO_OPTIONS,
  getFinalidadeLabel,
  getTipoLabel,
  getStatusOption,
} from "../constants";

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateInputValue(isoDate: string | null): string {
  if (!isoDate) return "";
  return formatDateOnly(new Date(isoDate));
}

const currencyBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ImovelDetailPanel() {
  const imovelDetailPanel = useImoveisStore((state) => state.imovelDetailPanel);
  const closeImovelDetailPanel = useImoveisStore((state) => state.closeImovelDetailPanel);
  const updateImovelInPlace = useImoveisStore((state) => state.updateImovelInPlace);
  const {
    handleGetImovel,
    handleUpdateImovel,
    handleUploadPhoto,
    handleDeletePhoto,
    handleReorderImovelPhotos,
  } = useImoveisIntegration();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ImovelPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState<"detalhes" | "editar">("detalhes");
  const [carouselIndex, setCarouselIndex] = useState(0);

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
  const [publicado, setPublicado] = useState(false);
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
  const [suites, setSuites] = useState("");
  const [areaTotal, setAreaTotal] = useState("");
  const [iptu, setIptu] = useState("");
  const [valorCondominio, setValorCondominio] = useState("");
  const [aceitaFinanciamento, setAceitaFinanciamento] = useState(false);
  const [aceitaPermuta, setAceitaPermuta] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [linkTourVirtual, setLinkTourVirtual] = useState("");
  const [areaExterna, setAreaExterna] = useState("");
  const [saving, setSaving] = useState(false);

  const imovel = imovelDetailPanel.imovel;

  useEffect(() => {
    if (!imovelDetailPanel.isOpen || !imovel) return;
    setActiveTab("detalhes");
    setCarouselIndex(0);
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
    setPublicado(imovel.publicado ?? false);
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
    setSuites(imovel.suites ? String(imovel.suites) : "");
    setAreaTotal(imovel.areaTotal ? String(imovel.areaTotal) : "");
    setIptu(imovel.iptu ? String(imovel.iptu) : "");
    setValorCondominio(imovel.valorCondominio ? String(imovel.valorCondominio) : "");
    setAceitaFinanciamento(imovel.aceitaFinanciamento ?? false);
    setAceitaPermuta(imovel.aceitaPermuta ?? false);
    setLatitude(imovel.latitude ? String(imovel.latitude) : "");
    setLongitude(imovel.longitude ? String(imovel.longitude) : "");
    setLinkTourVirtual(imovel.linkTourVirtual ?? "");
    setAreaExterna(imovel.areaExterna ? String(imovel.areaExterna) : "");
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

  async function handleMovePhoto(index: number, direction: -1 | 1) {
    if (!imovel) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setPhotos(reordered);
    const updated = await handleReorderImovelPhotos(imovel.id, reordered.map((p) => p.id));
    if (updated) {
      setPhotos(updated);
      updateImovelInPlace({ ...imovel, coverPhotoUrl: updated[0]?.url ?? null });
    } else {
      setPhotos(photos);
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
        publicado,
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
        suites: suites ? Number(suites) : undefined,
        areaTotal: areaTotal ? Number(areaTotal) : undefined,
        iptu: iptu ? Number(iptu) : undefined,
        valorCondominio: valorCondominio ? Number(valorCondominio) : undefined,
        aceitaFinanciamento,
        aceitaPermuta,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        linkTourVirtual: linkTourVirtual.trim() || undefined,
        areaExterna: areaExterna ? Number(areaExterna) : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  const statusOption = getStatusOption(imovel.status);
  const addressParts = [rua && `${rua}${numero ? ", " + numero : ""}`, complemento, bairro, cidade && uf ? `${cidade} - ${uf}` : cidade || uf, cep].filter(Boolean);
  const fullAddress = addressParts.join(", ");

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={closeImovelDetailPanel}
      />

      {/* Painel lateral */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusOption.badgeClassName}`}>
              {statusOption.label}
            </span>
            {imovel.codigoInterno && (
              <span className="text-xs text-slate-400">{imovel.codigoInterno}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              <button
                onClick={() => setActiveTab("detalhes")}
                className={`rounded-md px-3 py-1 text-sm font-medium transition ${activeTab === "detalhes" ? "bg-blue-700 text-white" : "text-slate-500 hover:text-slate-700"}`}
              >
                Detalhes
              </button>
              <button
                onClick={() => setActiveTab("editar")}
                className={`rounded-md px-3 py-1 text-sm font-medium transition ${activeTab === "editar" ? "bg-blue-700 text-white" : "text-slate-500 hover:text-slate-700"}`}
              >
                Editar
              </button>
            </div>
            <button onClick={closeImovelDetailPanel} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "detalhes" ? (
            <div>
              {/* Carrossel de fotos */}
              {photos.length > 0 ? (
                <div className="relative h-72 bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${API_BASE_URL}${photos[carouselIndex]?.url}`}
                    alt="Foto do imóvel"
                    className="h-full w-full object-cover opacity-95"
                  />
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                        disabled={carouselIndex === 0}
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-30 hover:bg-black/70"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setCarouselIndex((i) => Math.min(photos.length - 1, i + 1))}
                        disabled={carouselIndex === photos.length - 1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-30 hover:bg-black/70"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {photos.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCarouselIndex(i)}
                            className={`h-1.5 rounded-full transition-all ${i === carouselIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="rounded-md bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white uppercase">
                      {getFinalidadeLabel(imovel.finalidade)}
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
                    {carouselIndex + 1} / {photos.length}
                  </div>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-400 text-sm">
                  Sem fotos
                </div>
              )}

              {/* Conteudo principal */}
              <div className="px-6 py-5 space-y-6">
                {/* Titulo e tipo */}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {getTipoLabel(imovel.tipo)}
                  </p>
                  <h2 className="text-xl font-bold text-slate-800">{imovel.title}</h2>
                  {fullAddress && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                      <span>{fullAddress}</span>
                    </div>
                  )}
                </div>

                {/* Preco */}
                <div className="rounded-xl bg-slate-50 px-5 py-4">
                  {imovel.price && (
                    <div>
                      <p className="text-xs text-slate-500">Valor de venda</p>
                      <p className="text-2xl font-bold text-slate-800">{currencyBRL.format(imovel.price)}</p>
                    </div>
                  )}
                  {imovel.rentPrice && (
                    <div className={imovel.price ? "mt-2" : ""}>
                      <p className="text-xs text-slate-500">Valor de aluguel</p>
                      <p className="text-xl font-semibold text-slate-700">{currencyBRL.format(imovel.rentPrice)}<span className="text-sm font-normal text-slate-400">/mês</span></p>
                    </div>
                  )}
                  {!imovel.price && !imovel.rentPrice && (
                    <p className="text-sm text-slate-400">Preço a consultar</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    {imovel.valorCondominio && <span>Cond: {currencyBRL.format(imovel.valorCondominio)}/mês</span>}
                    {imovel.iptu && <span>IPTU: {currencyBRL.format(imovel.iptu)}/ano</span>}
                  </div>
                </div>

                {/* Ficha tecnica */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Ficha técnica</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {imovel.bedrooms != null && (
                      <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-white py-3 text-center shadow-sm">
                        <Bed className="mb-1 h-5 w-5 text-blue-600" />
                        <span className="text-lg font-bold text-slate-800">{imovel.bedrooms}</span>
                        <span className="text-xs text-slate-400">Quartos</span>
                      </div>
                    )}
                    {imovel.suites != null && imovel.suites > 0 && (
                      <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-white py-3 text-center shadow-sm">
                        <Bed className="mb-1 h-5 w-5 text-purple-500" />
                        <span className="text-lg font-bold text-slate-800">{imovel.suites}</span>
                        <span className="text-xs text-slate-400">Suítes</span>
                      </div>
                    )}
                    {imovel.bathrooms != null && (
                      <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-white py-3 text-center shadow-sm">
                        <Bath className="mb-1 h-5 w-5 text-blue-600" />
                        <span className="text-lg font-bold text-slate-800">{imovel.bathrooms}</span>
                        <span className="text-xs text-slate-400">Banheiros</span>
                      </div>
                    )}
                    {imovel.parkingSpots != null && (
                      <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-white py-3 text-center shadow-sm">
                        <Car className="mb-1 h-5 w-5 text-blue-600" />
                        <span className="text-lg font-bold text-slate-800">{imovel.parkingSpots}</span>
                        <span className="text-xs text-slate-400">Vagas</span>
                      </div>
                    )}
                    {imovel.area != null && (
                      <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-white py-3 text-center shadow-sm">
                        <Maximize2 className="mb-1 h-5 w-5 text-blue-600" />
                        <span className="text-lg font-bold text-slate-800">{imovel.area}</span>
                        <span className="text-xs text-slate-400">m² útil</span>
                      </div>
                    )}
                    {imovel.areaTotal != null && imovel.areaTotal > 0 && (
                      <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-white py-3 text-center shadow-sm">
                        <Maximize2 className="mb-1 h-5 w-5 text-slate-400" />
                        <span className="text-lg font-bold text-slate-800">{imovel.areaTotal}</span>
                        <span className="text-xs text-slate-400">m² total</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Diferenciais */}
                {(imovel.aceitaFinanciamento || imovel.aceitaPermuta || imovel.exclusividade) && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">Diferenciais</h3>
                    <div className="flex flex-wrap gap-2">
                      {imovel.aceitaFinanciamento && (
                        <span className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aceita financiamento
                        </span>
                      )}
                      {imovel.aceitaPermuta && (
                        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aceita permuta
                        </span>
                      )}
                      {imovel.exclusividade && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Exclusividade
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Descricao */}
                {imovel.description && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">Descrição</h3>
                    <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">{imovel.description}</p>
                  </div>
                )}

                {/* Tags */}
                {imovel.tags && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">Características</h3>
                    <div className="flex flex-wrap gap-2">
                      {imovel.tags.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                        <span key={tag} className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                          <Tag className="h-3 w-3" /> {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tour virtual */}
                {imovel.linkTourVirtual && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">Tour virtual</h3>
                    <a
                      href={imovel.linkTourVirtual}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 w-fit"
                    >
                      <ExternalLink className="h-4 w-4" /> Ver tour virtual
                    </a>
                  </div>
                )}

                {/* Mapa placeholder */}
                {imovel.latitude && imovel.longitude && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">Localização</h3>
                    <a
                      href={`https://www.google.com/maps?q=${imovel.latitude},${imovel.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-28 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm text-blue-600 hover:bg-slate-200 gap-2"
                    >
                      <MapPin className="h-4 w-4" /> Ver no Google Maps
                    </a>
                  </div>
                )}

                {/* Proprietario */}
                {(imovel.proprietarioNome || imovel.proprietarioTelefone) && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">Proprietário</h3>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-1">
                      {imovel.proprietarioNome && <p className="font-medium">{imovel.proprietarioNome}</p>}
                      {imovel.proprietarioTelefone && <p className="text-slate-500">{imovel.proprietarioTelefone}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Aba Editar — formulario preservado integralmente */
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-8">
                {/* Galeria de fotos */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Fotos</h3>
                  <div className="flex flex-wrap gap-3">
                    {photos.map((photo, index) => (
                      <div key={photo.id} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${API_BASE_URL}${photo.url}`} alt="Foto do imóvel" className="h-full w-full object-cover" />
                        <button type="button" onClick={() => handleRemovePhoto(photo.id)} className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block" aria-label="Remover foto">
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute inset-x-1 bottom-1 hidden items-center justify-between group-hover:flex">
                          <button type="button" onClick={() => handleMovePhoto(index, -1)} disabled={index === 0} className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30" aria-label="Mover para a esquerda">
                            <ArrowLeft className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => handleMovePhoto(index, 1)} disabled={index === photos.length - 1} className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30" aria-label="Mover para a direita">
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={handleAddPhotoClick} disabled={uploadingPhoto} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-60">
                      <Plus className="h-5 w-5" />
                      <span className="text-xs">{uploadingPhoto ? "Enviando..." : "Adicionar"}</span>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Informações Básicas</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Código interno</label>
                        <input type="text" placeholder="ex: AP-101" value={codigoInterno} onChange={(e) => setCodigoInterno(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Título</label>
                        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Tipo</label>
                        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                          {TIPO_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Uso</label>
                        <select value={uso} onChange={(e) => setUso(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                          <option value="">Não definido</option>
                          {USO_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Finalidade</label>
                        <select value={finalidade} onChange={(e) => setFinalidade(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                          {FINALIDADE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">Tags (separadas por vírgula)</label>
                      <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex: piscina, vista mar, mobiliado" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Situação e Chaves</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                          {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Disponível a partir de</label>
                        <input type="date" value={disponivelApartirDe} onChange={(e) => setDisponivelApartirDe(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                    </div>
                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <label className="mb-1 block text-sm text-slate-500">Local das chaves</label>
                        <select value={localChaves} onChange={(e) => setLocalChaves(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                          <option value="">Não definido</option>
                          {LOCAL_CHAVES_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                        <input type="checkbox" checked={exclusividade} onChange={(e) => setExclusividade(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                        Exclusividade
                      </label>
                      <label className="flex items-center gap-2 pb-2 text-sm text-slate-600" title="Mostra este imóvel no site imobiliário (só se estiver Disponível)">
                        <input type="checkbox" checked={publicado} onChange={(e) => setPublicado(e.target.checked)} data-testid="imovel-publicado" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                        Publicar no site
                      </label>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Localização</h3>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-sm text-slate-500">Rua</label>
                        <input type="text" value={rua} onChange={(e) => setRua(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                      <div className="w-24">
                        <label className="mb-1 block text-sm text-slate-500">Número</label>
                        <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Complemento</label>
                        <input type="text" value={complemento} onChange={(e) => setComplemento(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Bairro</label>
                        <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="mb-1 block text-sm text-slate-500">Cidade</label>
                        <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">UF</label>
                        <input type="text" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">CEP</label>
                      <input type="text" value={cep} onChange={(e) => setCep(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Proprietário</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">Nome</label>
                      <input type="text" value={proprietarioNome} onChange={(e) => setProprietarioNome(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">Telefone</label>
                      <input type="text" value={proprietarioTelefone} onChange={(e) => setProprietarioTelefone(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Valores</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">Preço de venda (R$)</label>
                      <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">Preço de aluguel (R$)</label>
                      <input type="number" step="0.01" min="0" value={rentPrice} onChange={(e) => setRentPrice(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">IPTU (R$/ano)</label>
                      <input type="number" step="0.01" min="0" value={iptu} onChange={(e) => setIptu(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">Condomínio (R$/mês)</label>
                      <input type="number" step="0.01" min="0" value={valorCondominio} onChange={(e) => setValorCondominio(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Características</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Área útil (m²)</label>
                        <input type="number" step="0.01" min="0" value={area} onChange={(e) => setArea(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Área total (m²)</label>
                        <input type="number" step="0.01" min="0" value={areaTotal} onChange={(e) => setAreaTotal(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Área externa (m²)</label>
                        <input type="number" step="0.01" min="0" value={areaExterna} onChange={(e) => setAreaExterna(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Quartos</label>
                        <input type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Suítes</label>
                        <input type="number" min="0" value={suites} onChange={(e) => setSuites(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Banheiros</label>
                        <input type="number" min="0" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Vagas</label>
                        <input type="number" min="0" value={parkingSpots} onChange={(e) => setParkingSpots(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={aceitaFinanciamento} onChange={(e) => setAceitaFinanciamento(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                        Aceita financiamento
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={aceitaPermuta} onChange={(e) => setAceitaPermuta(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                        Aceita permuta
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Latitude</label>
                        <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="-23.5505" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Longitude</label>
                        <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-46.6333" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">Link tour virtual</label>
                      <input type="url" value={linkTourVirtual} onChange={(e) => setLinkTourVirtual(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">Descrição</label>
                      <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
                    </div>
                  </div>
                </section>

                <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
