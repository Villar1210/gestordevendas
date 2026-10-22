// Icones de mapa dos concorrentes (divIcon com SVG proprio - os PNGs padrao do
// leaflet quebram no webpack). So importar de arquivos carregados com
// next/dynamic({ ssr: false }): o leaflet usa window.
import L from "leaflet";
import { COR_CONCORRENTE } from "../../constants-concorrentes";

// Predio estilizado em violeta (diferente do pino preto do endereco e dos
// pontos azul/verde do ITBI).
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 35c-1-1.4-12-13.6-12-21.5a12 12 0 0 1 24 0C26 21.4 15 33.6 14 35z" fill="${COR_CONCORRENTE}" stroke="#fff" stroke-width="2"/><rect x="9" y="7" width="10" height="12" rx="1" fill="#fff"/><rect x="11" y="9" width="2" height="2" fill="${COR_CONCORRENTE}"/><rect x="15" y="9" width="2" height="2" fill="${COR_CONCORRENTE}"/><rect x="11" y="13" width="2" height="2" fill="${COR_CONCORRENTE}"/><rect x="15" y="13" width="2" height="2" fill="${COR_CONCORRENTE}"/></svg>`;

export const iconeConcorrente = L.divIcon({
  html: SVG,
  className: "bii-pino-concorrente",
  iconSize: [28, 36],
  iconAnchor: [14, 35],
  popupAnchor: [0, -32],
});
