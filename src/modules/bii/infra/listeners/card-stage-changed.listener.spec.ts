import { Logger } from '@nestjs/common';
import { CardStageChangedListener } from './card-stage-changed.listener';
import { CardStageChangedEvent } from '../../domain/events/card-stage-changed.event';

function setup() {
  const repo = {
    buscarNomesEtapas: jest.fn().mockResolvedValue(
      new Map([
        ['s-from', 'Em Atendimento'],
        ['s-to', 'Fechamento'],
      ]),
    ),
    cardPertenceAoTenant: jest.fn().mockResolvedValue(true),
    registrar: jest.fn().mockResolvedValue(undefined),
  };
  return { repo, listener: new CardStageChangedListener(repo) };
}

const evento: CardStageChangedEvent = {
  tenantId: 't-1',
  cardId: 'c-1',
  pipelineId: 'p-1',
  fromStageId: 's-from',
  toStageId: 's-to',
  userId: 'u-1',
  origem: 'move',
  ocorridoEm: new Date('2026-10-01T12:00:00Z'),
  motivoRepique: null,
};

describe('CardStageChangedListener', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('grava o evento com os nomes das etapas buscados por id + tenantId', async () => {
    const { repo, listener } = setup();
    await listener.handle(evento);
    expect(repo.buscarNomesEtapas).toHaveBeenCalledWith('t-1', ['s-to', 's-from']);
    expect(repo.cardPertenceAoTenant).toHaveBeenCalledWith('t-1', 'c-1');
    expect(repo.registrar).toHaveBeenCalledWith({
      tenantId: 't-1',
      cardId: 'c-1',
      pipelineId: 'p-1',
      fromStageId: 's-from',
      toStageId: 's-to',
      fromStageNome: 'Em Atendimento',
      toStageNome: 'Fechamento',
      userId: 'u-1',
      origem: 'move',
      motivoRepique: null,
      ocorridoEm: evento.ocorridoEm,
    });
  });

  it('entrada no funil (fromStageId null)', async () => {
    const { repo, listener } = setup();
    await listener.handle({ ...evento, fromStageId: null, origem: 'criacao', userId: null });
    expect(repo.buscarNomesEtapas).toHaveBeenCalledWith('t-1', ['s-to']);
    expect(repo.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ fromStageId: null, fromStageNome: null, userId: null, origem: 'criacao' }),
    );
  });

  it('stage de destino fora do tenant: nao grava', async () => {
    const { repo, listener } = setup();
    repo.buscarNomesEtapas.mockResolvedValue(new Map());
    await listener.handle(evento);
    expect(repo.registrar).not.toHaveBeenCalled();
  });

  it('card de outro tenant: nao grava', async () => {
    const { repo, listener } = setup();
    repo.cardPertenceAoTenant.mockResolvedValue(false);
    await listener.handle(evento);
    expect(repo.registrar).not.toHaveBeenCalled();
  });

  it('erro do banco: so loga (sem PII), nunca lanca', async () => {
    const { repo, listener } = setup();
    const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    repo.registrar.mockRejectedValue(new Error('conexao caiu'));
    await expect(listener.handle(evento)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('c-1');
  });

  it('evento incompleto: ignora sem lancar', async () => {
    const { repo, listener } = setup();
    await expect(listener.handle({ ...evento, toStageId: '' })).resolves.toBeUndefined();
    expect(repo.registrar).not.toHaveBeenCalled();
  });
});
