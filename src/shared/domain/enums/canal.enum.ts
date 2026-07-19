// src/shared/domain/enums/canal.enum.ts
// Camada de DOMINIO: canais de comunicacao suportados (ou planejados) pelo
// projeto. So WHATSAPP e EMAIL tem provedor real conectado hoje (ver
// MessageDispatcherService) - os demais existem aqui para permitir que
// features novas (ex: Repique) ja programem contra o enum completo, sem
// precisar alterar assinaturas quando um novo canal for plugado de verdade.
export enum Canal {
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  INSTAGRAM = 'INSTAGRAM',
  FACEBOOK = 'FACEBOOK',
}
