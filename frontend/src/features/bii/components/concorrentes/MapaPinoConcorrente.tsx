// Mapa do formulario de concorrente: mostra o pino e, no modo "ajustar",
// clicar no mapa (ou arrastar o pino) move a posicao. So no navegador
// (leaflet usa window): carregado via next/dynamic({ ssr: false }).
"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { MAP_ATRIBUICAO, MAP_TILE_URL } from "../../constants-endereco";
import { iconeConcorrente } from "./icones-mapa";

interface Props {
  lat: number;
  lng: number;
  ajustando: boolean;
  onMover: (lat: number, lng: number) => void;
}

function Centralizar({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: false });
  }, [map, lat, lng]);
  return null;
}

function CliqueParaMover({ ativo, onMover }: { ativo: boolean; onMover: Props["onMover"] }) {
  useMapEvents({
    click(e) {
      if (ativo) onMover(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapaPinoConcorrente({ lat, lng, ajustando, onMover }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      scrollWheelZoom={false}
      className={`h-full w-full ${ajustando ? "cursor-crosshair" : ""}`}
      attributionControl
    >
      <TileLayer url={MAP_TILE_URL} attribution={MAP_ATRIBUICAO} maxZoom={19} />
      <Centralizar lat={lat} lng={lng} />
      <CliqueParaMover ativo={ajustando} onMover={onMover} />
      <Marker
        position={[lat, lng]}
        icon={iconeConcorrente}
        draggable={ajustando}
        keyboard={false}
        eventHandlers={{
          dragend: (e) => {
            const p = (e.target as L.Marker).getLatLng();
            onMover(p.lat, p.lng);
          },
        }}
      />
    </MapContainer>
  );
}
