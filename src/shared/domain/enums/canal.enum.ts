// src/shared/domain/enums/canal.enum.ts
// Camada de DOMINIO: canais de comunicacao suportados (ou planejados) pelo
// projeto. So WHATSAPP e EMAIL tem provedor real conectado hoje (ver
// MessageDispatcherService) - os demais existem aqui para permitir que
// features novas (ex: Repique, Redes Sociais) ja programem contra o enum
// completo, sem precisar alterar assinaturas quando um novo canal for
// plugado de verdade.
// LINKEDIN/TIKTOK/YOUTUBE adicionados para o modulo Redes Sociais
// (SocialAccount.canal) - assim como os demais, sem nenhum adapter/provider
// real ainda, so o valor do enum disponivel para a modelagem.
export enum Canal {
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  INSTAGRAM = 'INSTAGRAM',
  FACEBOOK = 'FACEBOOK',
  LINKEDIN = 'LINKEDIN',
  TIKTOK = 'TIKTOK',
  YOUTUBE = 'YOUTUBE',
}
