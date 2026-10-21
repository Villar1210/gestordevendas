// Repositorio FAKE de concorrentes para testes do BII (fora do build). RESPEITA
// tenantId como o Prisma: leitura/escrita/remocao so no proprio tenant.
import {
  ConcorrenteRegistro,
  DadosConcorrente,
  IConcorrenteRepository,
} from '../../src/modules/bii/domain/repositories/concorrente-repository.interface';
import type { BoundingBox } from '../../src/modules/bii/domain/services/geo';

export class ConcorrenteRepoFake implements IConcorrenteRepository {
  itens: (ConcorrenteRegistro & { tenantId: string; createdById: string; updatedById: string })[] = [];
  agora = new Date('2026-10-20T12:00:00Z');
  bboxes: BoundingBox[] = [];
  private seq = 0;

  async listarPorTenant(tenantId: string, limite: number) {
    return this.itens.filter((c) => c.tenantId === tenantId).slice(0, limite);
  }
  async buscarPorIdETenant(id: string, tenantId: string) {
    return this.itens.find((c) => c.id === id && c.tenantId === tenantId) ?? null;
  }
  async buscarNoBbox(tenantId: string, bbox: BoundingBox, limite: number) {
    this.bboxes.push(bbox);
    return this.itens
      .filter((c) => c.tenantId === tenantId && c.lat >= bbox.sul && c.lat <= bbox.norte && c.lng >= bbox.oeste && c.lng <= bbox.leste)
      .slice(0, limite);
  }
  async contarPorTenant(tenantId: string) {
    return this.itens.filter((c) => c.tenantId === tenantId).length;
  }
  async criar(tenantId: string, userId: string, d: DadosConcorrente) {
    this.seq += 1;
    const r = {
      ...d,
      tipologias: d.tipologias.map((t) => ({ ...t })),
      id: `c${this.seq}`,
      tenantId,
      createdById: userId,
      updatedById: userId,
      origem: 'manual',
      createdAt: this.agora,
      updatedAt: this.agora,
    };
    this.itens.push(r);
    return r;
  }
  async atualizar(id: string, tenantId: string, userId: string, d: DadosConcorrente) {
    const i = this.itens.findIndex((c) => c.id === id && c.tenantId === tenantId);
    if (i < 0) return false;
    this.itens[i] = { ...this.itens[i], ...d, tipologias: d.tipologias.map((t) => ({ ...t })), updatedById: userId, updatedAt: this.agora };
    return true;
  }
  async excluir(id: string, tenantId: string) {
    const antes = this.itens.length;
    this.itens = this.itens.filter((c) => !(c.id === id && c.tenantId === tenantId));
    return this.itens.length < antes;
  }

  // helper: cadastra direto (sem use case)
  semear(tenantId: string, p: Partial<DadosConcorrente> & { lat: number; lng: number }): ConcorrenteRegistro {
    this.seq += 1;
    const r = {
      nome: `Concorrente ${this.seq}`,
      construtora: null,
      endereco: 'Rua X, 1',
      enderecoFormatado: null,
      precisao: 'rooftop',
      fase: 'lancamento' as const,
      dataLancamento: null,
      totalUnidades: null,
      unidadesVendidas: null,
      fonte: null,
      fonteUrl: null,
      observacoes: null,
      tipologias: [{ descricao: '2 dorm.', dormitorios: 2, areaPrivativa: 40, precoDe: 280_000, precoAte: null }],
      ...p,
      id: `c${this.seq}`,
      tenantId,
      createdById: 'u',
      updatedById: 'u',
      origem: 'manual',
      createdAt: this.agora,
      updatedAt: this.agora,
    };
    this.itens.push(r);
    return r;
  }
}
