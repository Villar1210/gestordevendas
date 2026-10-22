import { ForbiddenException } from '@nestjs/common';
import { CalcularViabilidadeUseCase, GetParametrosViabilidadeUseCase, OBSERVACAO_VIABILIDADE } from './viabilidade.use-cases';

describe('Viabilidade use cases', () => {
  const agora = new Date(2026, 9, 21, 10);
  it('so Administrador', () => {
    expect(() => new GetParametrosViabilidadeUseCase().execute({ requesterRole: 'Corretor' })).toThrow(ForbiddenException);
    expect(() => new CalcularViabilidadeUseCase().execute({ requesterRole: 'Corretor', tipologias: [] })).toThrow(ForbiddenException);
  });
  it('parametros vigentes na data, com fontes', () => {
    const p = new GetParametrosViabilidadeUseCase().execute({ requesterRole: 'Administrador', agora });
    expect(p.dataReferencia).toBe('2026-10-21');
    expect(p.municipal.fonte).toContain('Decreto 64.895');
    expect(p.mcmv.vigenteDesde).toBe('2026-04-22');
  });
  it('premissas padrao preenchidas; descricao limpa; um resultado por tipologia', () => {
    const r = new CalcularViabilidadeUseCase().execute({
      requesterRole: 'Administrador',
      agora,
      tipologias: [
        { descricao: ' 2 dorm.‮ ', areaPrivativa: 36, preco: 239_000 },
        { descricao: '3 dorm.', areaPrivativa: 65, preco: 459_000 },
      ],
      premissas: { comprometimentoPercentual: 25 },
    });
    expect(r.premissas).toEqual({ entradaPercentual: 20, prazoMeses: 420, comprometimentoPercentual: 25, jurosAnual: null });
    expect(r.resultados.map((x) => x.descricao)).toEqual(['2 dorm.', '3 dorm.']);
    expect(r.resultados[1].municipal.categoria).toBe('HMP');
    expect(r.observacao).toBe(OBSERVACAO_VIABILIDADE);
  });
});
