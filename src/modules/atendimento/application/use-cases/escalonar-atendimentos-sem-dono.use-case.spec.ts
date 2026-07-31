// Achado I9 da auditoria: janela de escalonamento "sem dono" era 15min,
// revisada para 5min fixos - mesma regra para qualquer tenant/fila, sem
// configuracao por caso. Cobertura minima aqui (valor da constante + cutoff
// passado ao repositorio); a suite comportamental completa (emissao de
// evento, idempotencia via markEscalonamentoNotificado, resiliencia a erro
// por item) fica para o achado I14 (specs faltantes deste use case).
import {
  EscalonarAtendimentosSemDonoUseCase,
  ESCALONAMENTO_MINUTOS_LIMITE,
} from './escalonar-atendimentos-sem-dono.use-case';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
