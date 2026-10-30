// src/modules/vivi_sdr/domain/services/texto-construtora.ts
// Camada de DOMINIO (pura): qual texto institucional a VIVI usa no bloco
// "Sobre a construtora/incorporadora" (Construtoras, Fatia B).
// - Conversa com empreendimento cuja construtora tem "sobre" OU
//   "diferenciais" preenchido -> texto DESSA construtora (com o nome dela).
// - Senao (sem empreendimento, sem construtora ou construtora sem texto) ->
//   texto padrao da Configuracao da VIVI (decisao do Villar, 30/10/2026).
// Nunca mistura as duas fontes: um "diferenciais" da Direcional nao pode
// aparecer junto do "sobre" da Novolar.
import { ConstrutoraDoEmpreendimento } from '../repositories/construtora-do-empreendimento-repository.interface';

export interface TextoConstrutora {
  nomeConstrutora: string | null;
  sobreConstrutora: string | null;
  diferenciaisConstrutora: string | null;
  origem: 'empreendimento' | 'padrao';
}

function preenchido(valor: string | null | undefined): string | null {
  return valor?.trim() ? valor.trim() : null;
}

export function escolherTextoConstrutora(
  doEmpreendimento: ConstrutoraDoEmpreendimento | null,
  padrao: { sobreConstrutora?: string | null; diferenciaisConstrutora?: string | null },
): TextoConstrutora {
  const sobre = preenchido(doEmpreendimento?.sobre);
  const diferenciais = preenchido(doEmpreendimento?.diferenciais);
  if (doEmpreendimento && (sobre || diferenciais)) {
    return {
      nomeConstrutora: preenchido(doEmpreendimento.nome),
      sobreConstrutora: sobre,
      diferenciaisConstrutora: diferenciais,
      origem: 'empreendimento',
    };
  }
  return {
    nomeConstrutora: null,
    sobreConstrutora: padrao.sobreConstrutora ?? null,
    diferenciaisConstrutora: padrao.diferenciaisConstrutora ?? null,
    origem: 'padrao',
  };
}
