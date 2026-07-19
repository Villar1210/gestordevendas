// src/modules/vivi_sdr/domain/services/classificar-renda.ts
// Camada de DOMINIO: funcao pura, sem Prisma/NestJS/IA. A classificacao por
// faixa de renda e responsabilidade do CODIGO, nunca da IA - matematica de
// faixa de renda nao pode depender do modelo acertar. O valor persistido em
// ViviConversation.categoriaHabitacional SEMPRE vem desta funcao. A IA
// recebe as mesmas faixas (agora configuraveis por tenant via ViviConfig,
// ver constants/vivi-prompt.ts) so para escolher o argumento de venda certo
// na conversa - as duas fontes usam os mesmos numeros, mas so esta funcao e
// autoritativa para fins de registro/roteamento (ex: Repique).
//
// Nomenclatura 2026: FAIXA_1/2/3/4 substituem os nomes antigos HIS1/HIS2/
// HMP (conversas historicas gravadas com os nomes antigos continuam
// exibindo o texto antigo - "Categoria habitacional (interno)" no resumo
// do Card e so um label informativo, nunca comparado por igualdade em
// nenhum lugar do sistema). SEM_PERFIL e R2V continuam com os mesmos
// nomes e o mesmo papel de sempre - decisao confirmada com o usuario: a
// Faixa 1 NAO absorve o corte de SEM_PERFIL (continua um limite minimo
// separado), e renda acima da Faixa 4 continua caindo no argumento R2V
// (inalterado).
export type CategoriaHabitacional = 'SEM_PERFIL' | 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3' | 'FAIXA_4' | 'R2V';

export interface FaixasRenda {
  limiteSemPerfil: number;
  limiteFaixa1: number;
  limiteFaixa2: number;
  limiteFaixa3: number;
  limiteFaixa4: number;
}

export function classificarRenda(renda: number, faixas: FaixasRenda): CategoriaHabitacional {
  if (renda < faixas.limiteSemPerfil) return 'SEM_PERFIL';
  if (renda <= faixas.limiteFaixa1) return 'FAIXA_1';
  if (renda <= faixas.limiteFaixa2) return 'FAIXA_2';
  if (renda <= faixas.limiteFaixa3) return 'FAIXA_3';
  if (renda <= faixas.limiteFaixa4) return 'FAIXA_4';
  return 'R2V';
}
