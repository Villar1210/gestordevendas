import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SUPER_USUARIO_ROLE_NAME } from '../../../../shared/domain/constants/super-usuario';
import {
  GetGeocodificacaoItbiUseCase,
  ImportarItbiUseCase,
  IniciarGeocodificacaoItbiUseCase,
  IXlsxInspetor,
  sanitizarNomeArquivo,
} from './itbi-plataforma.use-cases';
import { ImportadorItbiService } from '../services/importador-itbi.service';
import { GeocodificacaoItbiService } from '../services/geocodificacao-itbi.service';

describe('ImportarItbiUseCase - validacao e limpeza do temporario', () => {
  let dir: string;
  let caminho: string;
  const iniciar = jest.fn(async () => ({ importacaoId: 'imp-1' }));
  const importador = { iniciar } as unknown as ImportadorItbiService;
  const inspetor: IXlsxInspetor = { temAssinaturaZip: jest.fn(async () => true), inspecionar: jest.fn(async () => undefined) };
  const uc = new ImportarItbiUseCase(importador, inspetor);

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'bii-uc-spec-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  beforeEach(() => {
    caminho = join(dir, `${Math.random()}.xlsx`);
    writeFileSync(caminho, 'PK\x03\x04...');
  });

  const input = (extra: Record<string, unknown> = {}) => ({
    requesterRole: SUPER_USUARIO_ROLE_NAME,
    requesterUserId: 'su-1',
    arquivo: { path: caminho, originalname: 'GUIAS DE ITBI PAGAS (30092026).xlsx', size: 10 },
    ano: '2026',
    ...extra,
  });

  it('ok: entrega ao importador (que passa a ser dono do arquivo) com nome sanitizado', async () => {
    await expect(uc.execute(input())).resolves.toEqual({ importacaoId: 'imp-1' });
    expect(iniciar).toHaveBeenCalledWith({ caminho, nomeArquivo: 'GUIAS DE ITBI PAGAS (30092026).xlsx', ano: 2026, userId: 'su-1' });
  });

  it.each([
    ['nao Super Usuario', { requesterRole: 'Administrador' }, ForbiddenException],
    ['ano invalido', { ano: 'abc' }, BadRequestException],
    ['ano fora da faixa', { ano: '1990' }, BadRequestException],
  ])('%s -> erro e o temporario e apagado', async (_n, extra, erro) => {
    await expect(uc.execute(input(extra))).rejects.toBeInstanceOf(erro);
    expect(existsSync(caminho)).toBe(false);
  });

  it('extensao diferente de .xlsx (ex.: .xlsm) -> 400 e apaga', async () => {
    await expect(uc.execute(input({ arquivo: { path: caminho, originalname: 'x.xlsm', size: 1 } }))).rejects.toThrow('.xlsx');
    expect(existsSync(caminho)).toBe(false);
  });

  it('sem assinatura ZIP ou ZIP suspeito -> 400 e apaga', async () => {
    (inspetor.temAssinaturaZip as jest.Mock).mockResolvedValueOnce(false);
    await expect(uc.execute(input())).rejects.toThrow('não é uma planilha');
    expect(existsSync(caminho)).toBe(false);
    writeFileSync(caminho, 'x');
    (inspetor.inspecionar as jest.Mock).mockRejectedValueOnce(new Error('A planilha contém macros. Salve como .xlsx sem macros.'));
    await expect(uc.execute(input())).rejects.toThrow('macros');
    expect(existsSync(caminho)).toBe(false);
  });

  it('sanitizarNomeArquivo: sem caminho, sem controle/bidi, curto', () => {
    expect(sanitizarNomeArquivo('../../etc/pass\u202ewd.xlsx')).toBe('passwd.xlsx');
    expect(sanitizarNomeArquivo('C:\\Users\\a\\b<c>.xlsx')).toBe('b_c_.xlsx');
    expect(sanitizarNomeArquivo('')).toBe('planilha.xlsx');
    expect(sanitizarNomeArquivo('a'.repeat(300))).toHaveLength(120);
  });
});

describe('Geocodificacao em lote - use cases', () => {
  const job = { iniciar: jest.fn(async (f) => ({ id: 'g1', filtros: f })), status: jest.fn(() => null) } as unknown as GeocodificacaoItbiService;
  const iniciar = new IniciarGeocodificacaoItbiUseCase(job);

  it('so Super Usuario', async () => {
    await expect(iniciar.execute({ requesterRole: 'Administrador', ceps: ['03277'] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(() => new GetGeocodificacaoItbiUseCase(job).execute({ requesterRole: 'Administrador' })).toThrow(ForbiddenException);
  });

  it('valida prefixo de CEP de 5 digitos, exige filtro, normaliza bairro, max padrao 2000', async () => {
    await expect(iniciar.execute({ requesterRole: SUPER_USUARIO_ROLE_NAME, ceps: ['0327'] })).rejects.toThrow('5 dígitos');
    await expect(iniciar.execute({ requesterRole: SUPER_USUARIO_ROLE_NAME })).rejects.toThrow('ao menos um');
    await expect(iniciar.execute({ requesterRole: SUPER_USUARIO_ROLE_NAME, ceps: ['03277'], max: 6000 })).rejects.toThrow('5000');
    await iniciar.execute({ requesterRole: SUPER_USUARIO_ROLE_NAME, ceps: ['03277', '03277'], bairros: ['Vila Ema'] });
    expect(job.iniciar).toHaveBeenLastCalledWith({ ceps: ['03277'], bairros: ['vila ema'], max: 2000 });
  });
});
