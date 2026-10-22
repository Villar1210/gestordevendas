// Mapa da Analise por Endereco (leaflet + react-leaflet). So roda no
// navegador: o leaflet usa window ao ser importado, por isso a tela carrega
// este arquivo via next/dynamic({ ssr: false }). Sem os PNGs padrao do
// marcador do leaflet (quebram no webpack): pino via divIcon com SVG
// proprio e transacoes como CircleMarker.
"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { formatMoeda } from "../../constants";
import {
  corDoPreco,
  formatArea,
  formatDataTransacao,
  formatDistancia,
  formatEnderecoTransacao,
  formatPrecoM2,
  MAP_ATRIBUICAO,
  MAP_TILE_URL,
} from "../../constants-endereco";
import type { AnaliseEnderecoResponse } from "../../types-endereco";
import { getFase } from "../../constants-concorrentes";
import { iconeConcorrente } from "../concorrentes/icones-mapa";

interface MapaAnaliseProps {
  analise: AnaliseEnderecoResponse;
}

// Pino do endereco analisado (slate-900 para nao competir com os azuis das
// transacoes). Ancora na ponta de baixo.
const PINO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39c-1.2-1.6-13-15.4-13-24a13 13 0 0 1 26 0c0 8.6-11.8 22.4-13 24z" fill="#0f172a" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>`;

const pinoIcon = L.divIcon({
  html: PINO_SVG,
  className: "bii-pino-endereco",
  iconSize: [30, 40],
  iconAnchor: [15, 39],
  popupAnchor: [0, -36],
});

// Enquadra o circulo do raio sempre que a analise muda (o MapContainer so
// le center/zoom na montagem).
function AjustarVisao({ lat, lng, raio }: { lat: number; lng: number; raio: number }) {
  const map = useMap();
  useEffect(() => {
    const enquadrar = () => {
      map.invalidateSize();
      map.fitBounds(L.latLng(lat, lng).toBounds(raio * 2.2), { animate: false });
    };
    enquadrar();
    // O container pode mudar de tamanho depois de montar (carregamento
    // dinamico, troca de breakpoint): reenquadra quando isso acontece.
    const observer = new ResizeObserver(enquadrar);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, lat, lng, raio]);
  return null;
}

export default function MapaAnalise({ analise }: MapaAnaliseProps) {
  const { endereco, parametros, resumo, amostra } = analise;
  const centro: [number, number] = [endereco.lat, endereco.lng];

  // Mais distantes primeiro: os pontos mais proximos ficam por cima.
  const pontos = useMemo(
    () => [...amostra].sort((a, b) => b.distanciaMetros - a.distanciaMetros),
    [amostra],
  );

  return (
    <MapContainer
      center={centro}
      zoom={15}
      scrollWheelZoom={false}
      zoomSnap={0.25}
      zoomDelta={0.5}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer url={MAP_TILE_URL} attribution={MAP_ATRIBUICAO} maxZoom={19} />
      <AjustarVisao lat={endereco.lat} lng={endereco.lng} raio={parametros.raioMetros} />
      <Circle
        center={centro}
        radius={parametros.raioMetros}
        pathOptions={{ color: "#2563eb", weight: 1.5, dashArray: "6 5", fillColor: "#2563eb", fillOpacity: 0.05 }}
        interactive={false}
      />
      {pontos.map((t, i) => (
        <CircleMarker
          key={`${t.lat}-${t.lng}-${t.data}-${i}`}
          center={[t.lat, t.lng]}
          radius={6}
          pathOptions={{
            color: "#ffffff",
            weight: 1.5,
            fillColor: corDoPreco(t.precoM2, resumo.precoM2P25, resumo.precoM2Mediano, resumo.precoM2P75),
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <div className="min-w-[180px] text-xs leading-relaxed text-slate-700">
              <p className="font-semibold text-slate-900">{formatEnderecoTransacao(t)}</p>
              {t.bairro && <p className="text-slate-500">{t.bairro}</p>}
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2">
                <dt className="text-slate-500">Data</dt>
                <dd>{formatDataTransacao(t.data)}</dd>
                <dt className="text-slate-500">Valor</dt>
                <dd>{formatMoeda(t.valor)}</dd>
                <dt className="text-slate-500">Área</dt>
                <dd>{formatArea(t.areaConstruida)}</dd>
                <dt className="text-slate-500">R$/m²</dt>
                <dd>{formatPrecoM2(t.precoM2)}</dd>
                <dt className="text-slate-500">Distância</dt>
                <dd>{formatDistancia(t.distanciaMetros)}</dd>
              </dl>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      {(analise.concorrentes?.itens ?? []).map((c) => (
        <Marker key={c.id} position={[c.lat, c.lng]} icon={iconeConcorrente} zIndexOffset={1500} keyboard={false}>
          <Popup>
            <div className="min-w-[180px] text-xs leading-relaxed text-slate-700">
              <p className="font-semibold text-slate-900">{c.nome}</p>
              <p className="text-slate-500">{[c.construtora, getFase(c.fase).label].filter(Boolean).join(" · ")}</p>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2">
                <dt className="text-slate-500">R$/m²</dt>
                <dd>{formatPrecoM2(c.calculado.precoM2Mediano)}</dd>
                <dt className="text-slate-500">A partir de</dt>
                <dd>{c.calculado.precoMin === null ? "—" : formatMoeda(c.calculado.precoMin)}</dd>
                <dt className="text-slate-500">Distância</dt>
                <dd>{formatDistancia(c.distanciaMetros)}</dd>
              </dl>
              <p className="mt-1 text-[11px] text-slate-400">Concorrente cadastrado pela empresa</p>
            </div>
          </Popup>
        </Marker>
      ))}
      <Marker position={centro} icon={pinoIcon} zIndexOffset={1000} keyboard={false}>
        <Popup>
          <div className="text-xs text-slate-700">
            <p className="font-semibold text-slate-900">Endereço analisado</p>
            <p>{endereco.formatado}</p>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
