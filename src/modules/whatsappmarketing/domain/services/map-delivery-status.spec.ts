// Listener de confirmacao de entrega (ver CLAUDE.md "sem o ACK, os dois
// casos sao indistinguiveis..."). mapBaileysAckStatusToStatusEntrega e a
// funcao pura que traduz o status numerico do Baileys - testada isolada,
// sem depender do proprio pacote "baileys" nem de um socket real.
import { mapBaileysAckStatusToStatusEntrega } from './map-delivery-status';

describe('mapBaileysAckStatusToStatusEntrega', () => {
  it('ERROR (0) -> "failed"', () => {
    expect(mapBaileysAckStatusToStatusEntrega(0)).toBe('failed');
  });

  it('PENDING (1) -> "pending"', () => {
    expect(mapBaileysAckStatusToStatusEntrega(1)).toBe('pending');
  });

  it('SERVER_ACK (2) -> "server_ack"', () => {
    expect(mapBaileysAckStatusToStatusEntrega(2)).toBe('server_ack');
  });

  it('DELIVERY_ACK (3) -> "delivery_ack"', () => {
    expect(mapBaileysAckStatusToStatusEntrega(3)).toBe('delivery_ack');
  });

  it('READ (4) -> "read"', () => {
    expect(mapBaileysAckStatusToStatusEntrega(4)).toBe('read');
  });

  it('PLAYED (5, audio ouvido) tambem colapsa em "read"', () => {
    expect(mapBaileysAckStatusToStatusEntrega(5)).toBe('read');
  });

  it('valor desconhecido/futuro: retorna null em vez de gravar algo incorreto', () => {
    expect(mapBaileysAckStatusToStatusEntrega(99)).toBeNull();
    expect(mapBaileysAckStatusToStatusEntrega(-1)).toBeNull();
  });
});
