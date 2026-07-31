// Achado I9 da auditoria: janela de escalonamento "sem dono" era 15min,
// revisada para 5min fixos - mesma regra para qualquer tenant/fila, sem
// configuracao por caso. Cobertura minima aqui (valor da constante + cutoff
// passado ao repositorio); a suite comportamental completa (emissao de
// evento, idempotencia via markEscalonamentoNotificado, resiliencia a erro
// por item) foi adicionada no achado I14, describe separado abaixo.
import {
  EscalonarAtendimentosSemDonoUseCase,
  ESCALONAMENTO_MINUTOS_LIMITE,
} from './escalonar-atendimentos-sem-dono.use-case';
import {
  IAtendimentoRepository,
  AtendimentoWithNames,
} from '../../domain/repositories/atendimento-repository.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { buildAtendimentoRecord } from '../../../../../test/factories/atendimento-record.factory';

// findAguardandoSemDonoNaoEscalonados devolve AtendimentoWithNames (com
// filaNome via join) - buildAtendimentoRecord (AtendimentoRecord puro) nao
// tem esse campo, entao complementamos aqui so para os testes deste arquivo.
function buildPendente(
  overrides: Partial<AtendimentoWithNames> & { minutosAtras?: number } = {},
): AtendimentoWithNames {
  const { minutosAtras, ...rest } = overrides;
  // +2s de folga para o floor() do use case nunca arredondar para baixo por
  // causa dos poucos milissegundos que o proprio teste leva para rodar.
  const createdAt =
    minutosAtras !== undefined
      ? new Date(Date.now() - minutosAtras * 60_000 - 2000)
      : new Date();
  return {
    ...buildAtendimentoRecord({ createdAt }),
    filaNome: null,
    ownerName: null,
    ...rest,
  } as AtendimentoWithNames;
}

describe('EscalonarAtendimentosSemDonoUseCase - janela de escalonamento (I9)', () => {
  it('ESCALONAMENTO_MINUTOS_LIMITE e 5 (nao mais 15)', () => {
    expect(ESCALONAMENTO_MINUTOS_LIMITE).toBe(5);
  });

  it('busca atendimentos usando um cutoff de exatamente 5 minutos atras', async () => {
    const atendimentoRepository = {
      findAguardandoSemDonoNaoEscalonados: jest.fn().mockResolvedValue([]),
    };
    const eventEmitter = { emit: jest.fn() };
    const useCase = new EscalonarAtendimentosSemDonoUseCase(
      atendimentoRepository as unknown as IAtendimentoRepository,
      eventEmitter as unknown as EventEmitter2,
    );

    const antes = Date.now();
    await useCase.execute();
    const depois = Date.now();

    expect(atendimentoRepository.findAguardandoSemDonoNaoEscalonados).toHaveBeenCalledTimes(1);
    const cutoffPassado = atendimentoRepository.findAguardandoSemDonoNaoEscalonados.mock
      .calls[0][0] as Date;
    const minutosDeDiferencaMin = (antes - cutoffPassado.getTime()) / 60_000;
    const minutosDeDiferencaMax = (depois - cutoffPassado.getTime()) / 60_000;

    expect(minutosDeDiferencaMin).toBeGreaterThanOrEqual(4.99);
    expect(minutosDeDiferencaMax).toBeLessThanOrEqual(5.01);
  });
});

function setup(pendentes: AtendimentoWithNames[]) {
  const atendimentoRepository = {
    findAguardandoSemDonoNaoEscalonados: jest.fn().mockResolvedValue(pendentes),
    markEscalonamentoNotificado: jest.fn().mockResolvedValue(undefined),
  };
  const eventEmitter = { emit: jest.fn() };
  const useCase = new EscalonarAtendimentosSemDonoUseCase(
    atendimentoRepository as unknown as IAtendimentoRepository,
    eventEmitter as unknown as EventEmitter2,
  );
  return { useCase, atendimentoRepository, eventEmitter };
}

describe('EscalonarAtendimentosSemDonoUseCase - comportamento (I14)', () => {
  it('sem nenhum atendimento pendente: nao marca nem emite nada', async () => {
    const { useCase, atendimentoRepository, eventEmitter } = setup([]);

    await useCase.execute();

    expect(atendimentoRepository.markEscalonamentoNotificado).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('marca escalonamentoNotificado e emite "atendimento.sem_dono.escalonado" com o payload correto', async () => {
    const pendente = buildPendente({
      id: 'atendimento-1',
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      filaNome: 'Suporte',
      minutosAtras: 7,
    });
    const { useCase, atendimentoRepository, eventEmitter } = setup([pendente]);

    await useCase.execute();

    expect(atendimentoRepository.markEscalonamentoNotificado).toHaveBeenCalledWith('atendimento-1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'atendimento.sem_dono.escalonado',
      expect.objectContaining({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        phoneNumber: '5511999990000',
        filaNome: 'Suporte',
        minutosAguardando: 7,
      }),
    );
  });

  it('marca ANTES de emitir - se markEscalonamentoNotificado falhar, o evento NUNCA e emitido para aquele item', async () => {
    const pendente = buildPendente({ id: 'atendimento-1', minutosAtras: 6 });
    const { useCase, atendimentoRepository, eventEmitter } = setup([pendente]);
    atendimentoRepository.markEscalonamentoNotificado.mockRejectedValue(new Error('DB indisponivel'));

    await expect(useCase.execute()).resolves.not.toThrow();

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('processa MULTIPLOS atendimentos pendentes na mesma execucao, um evento por item', async () => {
    const pendentes = [
      buildPendente({ id: 'atendimento-1', tenantId: 'tenant-1', minutosAtras: 6 }),
      buildPendente({ id: 'atendimento-2', tenantId: 'tenant-2', minutosAtras: 10 }),
      buildPendente({ id: 'atendimento-3', tenantId: 'tenant-1', minutosAtras: 20 }),
    ];
    const { useCase, atendimentoRepository, eventEmitter } = setup(pendentes);

    await useCase.execute();

    expect(atendimentoRepository.markEscalonamentoNotificado).toHaveBeenCalledTimes(3);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(3);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'atendimento.sem_dono.escalonado',
      expect.objectContaining({ atendimentoId: 'atendimento-1', minutosAguardando: 6 }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'atendimento.sem_dono.escalonado',
      expect.objectContaining({ atendimentoId: 'atendimento-2', minutosAguardando: 10 }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'atendimento.sem_dono.escalonado',
      expect.objectContaining({ atendimentoId: 'atendimento-3', minutosAguardando: 20 }),
    );
  });

  it('resiliencia: um atendimento com erro NAO impede o processamento dos demais no mesmo lote', async () => {
    const pendentes = [
      buildPendente({ id: 'atendimento-com-erro', minutosAtras: 6 }),
      buildPendente({ id: 'atendimento-ok', minutosAtras: 8 }),
    ];
    const { useCase, atendimentoRepository, eventEmitter } = setup(pendentes);
    atendimentoRepository.markEscalonamentoNotificado.mockImplementation((id: string) =>
      id === 'atendimento-com-erro'
        ? Promise.reject(new Error('falha pontual'))
        : Promise.resolve(undefined),
    );

    await expect(useCase.execute()).resolves.not.toThrow();

    // O item com erro nao emite (ja coberto no teste anterior) - mas o
    // segundo item do MESMO lote continua sendo processado normalmente.
    expect(atendimentoRepository.markEscalonamentoNotificado).toHaveBeenCalledWith('atendimento-com-erro');
    expect(atendimentoRepository.markEscalonamentoNotificado).toHaveBeenCalledWith('atendimento-ok');
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'atendimento.sem_dono.escalonado',
      expect.objectContaining({ atendimentoId: 'atendimento-ok' }),
    );
  });

  it('idempotencia (simulada): um atendimento ja marcado nao volta a aparecer na busca, entao nao e reprocessado numa proxima chamada', async () => {
    const pendente = buildPendente({ id: 'atendimento-1', minutosAtras: 6 });
    const { useCase, atendimentoRepository, eventEmitter } = setup([pendente]);

    await useCase.execute();
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);

    // Uma implementacao real de findAguardandoSemDonoNaoEscalonados filtra
    // por escalonamentoNotificadoEm=null - apos marcar, o mesmo item nao
    // seria devolvido de novo. Simulado aqui trocando o mock para refletir
    // esse estado, ja que o repositorio e mockado (nao ha banco real neste
    // teste unitario).
    atendimentoRepository.findAguardandoSemDonoNaoEscalonados.mockResolvedValue([]);

    await useCase.execute();

    // Nenhuma chamada NOVA de marcacao/evento na segunda execucao.
    expect(atendimentoRepository.markEscalonamentoNotificado).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });
});
