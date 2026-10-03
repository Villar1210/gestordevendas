import { normalizarTelefoneBR, formatarDataVisita, montarAvisoAgendamento } from './aviso-agendamento';

describe('aviso-agendamento', () => {
  describe('normalizarTelefoneBR', () => {
    it('aceita numero com mascara e adiciona o DDI 55', () => {
      expect(normalizarTelefoneBR('(11) 97387-9858')).toBe('5511973879858');
    });
    it('mantem numero que ja tem DDI', () => {
      expect(normalizarTelefoneBR('+55 11 97387-9858')).toBe('5511973879858');
    });
    it('aceita fixo com 10 digitos', () => {
      expect(normalizarTelefoneBR('1133334444')).toBe('551133334444');
    });
    it('retorna nulo para vazio ou invalido', () => {
      expect(normalizarTelefoneBR(null)).toBeNull();
      expect(normalizarTelefoneBR('')).toBeNull();
      expect(normalizarTelefoneBR('12345')).toBeNull();
    });
  });

  describe('formatarDataVisita', () => {
    it('nao volta um dia por causa do fuso (data pura)', () => {
      // 03/10/2026 e um sabado
      expect(formatarDataVisita('2026-10-03')).toBe('sábado, 03/10');
    });
    it('vira o ano corretamente', () => {
      expect(formatarDataVisita('2027-01-01')).toBe('sexta-feira, 01/01');
    });
  });

  describe('montarAvisoAgendamento', () => {
    it('usa o telefone quando nao ha nome e omite perfil vazio', () => {
      const texto = montarAvisoAgendamento({ phoneNumber: '5511999998888', dataVisita: '2026-10-03', horario: '10:00', resumo: '  ' });
      expect(texto).toContain('Cliente: 5511999998888');
      expect(texto).toContain('sábado, 03/10 às 10:00');
      expect(texto).not.toContain('Perfil');
    });
    it('inclui nome e perfil quando informados', () => {
      const texto = montarAvisoAgendamento({ nomeCliente: 'Maria', phoneNumber: '5511999998888', dataVisita: '2026-10-03', horario: '10:00', resumo: 'Renda 6k, FGTS' });
      expect(texto).toContain('Cliente: Maria');
      expect(texto).toContain('Perfil: Renda 6k, FGTS');
    });
  });
});
