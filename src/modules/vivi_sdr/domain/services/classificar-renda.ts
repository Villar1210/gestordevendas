// src/modules/vivi_sdr/domain/services/classificar-renda.ts
// Camada de DOMINIO: funcao pura, sem Prisma/NestJS/IA. A classificacao por
// faixa de renda e responsabilidade do CODIGO, nunca da IA - matematica de
// faixa de renda nao pode depender do modelo acertar. O valor persistido em
// ViviConversation.categoriaHabitacional SEMPRE vem desta funcao. A IA
// recebe as mesmas faixas descritas em constants/vivi-prompt.ts so para
// escolher o argumento de venda certo na conversa - as duas fontes usam os
// mesmos numeros, mas so esta funcao e autoritativa para fins de registro/
// roteamento (ex: Repique).
export type CategoriaHabitacional = 'HIS1' | 'HIS2' | 'HMP' | 'R2V' | 'SEM_PERFIL';

export function classificarRenda(renda: number): CategoriaHabitacional {
  if (renda < 1500) return 'SEM_PERFIL';
  if (renda <= 2850) return 'HIS1';
  if (renda <= 4700) return 'HIS2';
  if (renda <= 8000) return 'HMP';
  return 'R2V';
}
