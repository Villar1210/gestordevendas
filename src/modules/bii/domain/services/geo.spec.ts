import { boundingBox, dentroDaGrandeSP, dentroDoRaio, distanciaMetros, RAIO_TERRA_METROS } from './geo';

const SE = { lat: -23.55052, lng: -46.633308 }; // Praca da Se
const MASP = { lat: -23.561414, lng: -46.655881 }; // Av. Paulista, 1578

// lei dos cossenos esferica (formula independente para conferir o haversine)
function cossenos(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (g: number) => (g * Math.PI) / 180;
  return (
    RAIO_TERRA_METROS *
    Math.acos(Math.sin(r(a.lat)) * Math.sin(r(b.lat)) + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng)))
  );
}

describe('geo - haversine', () => {
  it('mesma coordenada = 0', () => {
    expect(distanciaMetros(SE, SE)).toBe(0);
  });

  it('Praca da Se -> MASP (Av. Paulista) ~ 2,6 km, igual a outra formula (+-0,1%)', () => {
    const d = distanciaMetros(SE, MASP);
    expect(d).toBeGreaterThan(2500);
    expect(d).toBeLessThan(2700);
    expect(Math.abs(d - cossenos(SE, MASP)) / d).toBeLessThan(0.001);
  });

  it('0,01 grau de latitude = ~1.112 m', () => {
    expect(distanciaMetros({ lat: -23.5, lng: -46.6 }, { lat: -23.51, lng: -46.6 })).toBeCloseTo(1111.95, 0);
  });

  it('simetrica', () => {
    expect(distanciaMetros(SE, MASP)).toBeCloseTo(distanciaMetros(MASP, SE), 6);
  });

  it('coordenada invalida lanca erro', () => {
    expect(() => distanciaMetros({ lat: 91, lng: 0 }, SE)).toThrow();
    expect(() => distanciaMetros({ lat: Number.NaN, lng: 0 }, SE)).toThrow();
  });

  it('dentroDoRaio e inclusivo no limite', () => {
    const d = distanciaMetros(SE, MASP);
    expect(dentroDoRaio(SE, MASP, d)).toBe(true);
    expect(dentroDoRaio(SE, MASP, d - 0.01)).toBe(false);
  });
});

describe('geo - bounding box', () => {
  it('contem os pontos a exatamente R de distancia nos 4 sentidos', () => {
    const raio = 1000;
    const bb = boundingBox(SE, raio);
    const dLat = (raio / RAIO_TERRA_METROS) * (180 / Math.PI);
    expect(bb.norte).toBeGreaterThan(SE.lat + dLat);
    expect(bb.sul).toBeLessThan(SE.lat - dLat);
    // o canto leste em cima da mesma latitude, a 1000 m, cabe
    const leste = { lat: SE.lat, lng: SE.lng + 0.0098 };
    expect(distanciaMetros(SE, leste)).toBeLessThan(1000);
    expect(leste.lng).toBeLessThan(bb.leste);
    // largura em longitude e maior que em latitude (cos(lat) < 1)
    expect(bb.leste - bb.oeste).toBeGreaterThan(bb.norte - bb.sul);
  });

  it('raio invalido lanca erro', () => {
    expect(() => boundingBox(SE, 0)).toThrow();
  });

  it('Grande SP', () => {
    expect(dentroDaGrandeSP(SE)).toBe(true);
    expect(dentroDaGrandeSP({ lat: -23.65, lng: -46.53 })).toBe(true); // Santo Andre
    expect(dentroDaGrandeSP({ lat: -22.9, lng: -43.2 })).toBe(false); // Rio
    expect(dentroDaGrandeSP({ lat: -22.9, lng: -47.06 })).toBe(false); // Campinas
  });
});
