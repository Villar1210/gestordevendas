// test/factories/card-record.factory.ts
// Fabrica de CardRecord para testes unitarios que precisam de um repositorio
// mockado retornando cards - preenche todos os campos obrigatorios com um
// valor neutro, sobrescrevivel via `overrides`.
import { CardRecord } from '../../src/modules/vendas_kanban/domain/repositories/card-repository.interface';

let counter = 0;

export function buildCardRecord(overrides: Partial<CardRecord> = {}): CardRecord {
  counter += 1;
  const now = new Date();
  return {
    id: `card-${counter}`,
    tenantId: 'tenant-1',
    pipelineId: 'pipeline-1',
    stageId: null,
    ownerId: null,
    suggestedOwnerId: null,
    suggestedOwnerName: null,
    atribuidoAutomaticamenteEm: null,
    aceitoEm: null,
    motivoRepique: null,
    movidoParaRepiqueEm: null,
    repiqueOptOut: false,
    repiqueOptOutToken: null,
    stageName: null,
    ownerName: null,
    imovelId: null,
    title: `Lead de teste ${counter}`,
    value: 0,
    position: 0,
    origem: 'teste',
    phone: null,
    temperatura: null,
    email: null,
    endereco: null,
    numero: null,
    complemento: null,
    bairro: null,
    cep: null,
    description: null,
    customFields: {},
    createdAt: now,
    updatedAt: now,
    escalonamentoNotificadoEm: null,
    proximaAtividade: null,
    ...overrides,
  };
}
