// src/modules/vivi_sdr/domain/constants/limite-vivi.ts
// Chute inicial de limite diario de mensagens da VIVI por tenant (500/dia) -
// mesmo numero usado como @default no schema.prisma (Tenant.limiteMensagensViviDia).
// Unico tenant real em producao ate hoje (Villar); ajustavel por tenant via
// PATCH /configuracoes/empresa. So usado aqui como fallback defensivo (ver
// RegistrarUsoViviUseCase) - na pratica a coluna do banco sempre tem um
// valor (NOT NULL com default), entao este fallback so importa se a leitura
// do Tenant falhar de algum jeito inesperado.
export const DEFAULT_LIMITE_MENSAGENS_VIVI_DIA = 500;

// 3 niveis de volume diario (ver RegistrarUsoViviUseCase): Normal (<=100%
// do limite), Atencao (>100% e <=200%), Critico (>200%). Cada nivel dispara
// no maximo 1 notificacao por tenant por dia (flags proprias em
// ViviUsoDiario), independente uma da outra.
export const LIMITE_CRITICO_MULTIPLICADOR = 2;

// Suspeita de uso concentrado (poucos numeros/contatos distintos gerando
// muitas mensagens no dia - possivel spam/loop, em vez de atendimento real
// a varios leads). Chute inicial: media acima de 20 mensagens por numero
// distinto no dia. Independente do nivel de volume acima (avaliado todo dia,
// mesmo com volume Normal) - decisao confirmada com o usuario antes de
// implementar.
export const RAZAO_SUSPEITA_CONCENTRACAO_MSGS_POR_NUMERO = 20;
