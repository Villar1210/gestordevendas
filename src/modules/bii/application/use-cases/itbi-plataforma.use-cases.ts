// src/modules/bii/application/use-cases/itbi-plataforma.use-cases.ts
// Rotas do Super Usuario (/bii-plataforma/itbi/*): importar a planilha,
// historico, geocodificar por regiao e progresso. Checagem de role repetida
// aqui (o guard da classe ja exige SUPER_USUARIO_ROLE_NAME).
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { chmod, unlink } from 'fs/promises';
import {
  IItbiImportacaoRepository,
  ITBI_IMPORTACAO_REPOSITORY,
  ItbiImportacaoRegistro,
} from '../../domain/repositories/itbi-importacao-repository.interface';
import { normalizarBairro } from '../../domain/services/endereco';
import { ImportadorItbiService } from '../services/importador-itbi.service';
import {
  GEOCODE_LOTE_MAX,
  GEOCODE_LOTE_PADRAO,
  GeocodificacaoItbiService,
  ProgressoGeocodificacao,
} from '../services/geocodificacao-itbi.service';
import { exigirSuperUsuario } from './permissoes-bii';

// Conferencias do arquivo .xlsx (infra) injetadas por token para o use case
// nao conhecer fs/zip diretamente alem de apagar/proteger o temporario.
export const XLSX_INSPETOR = 'BII_XLSX_INSPETOR';
export interface IXlsxInspetor {
  temAssinaturaZip(caminho: string): Promise<boolean>;
  // lanca erro com mensagem amigavel se o ZIP for suspeito
  inspecionar(caminho: string): Promise<void>;
}

export const ANO_MIN_ITBI = 2000;
export const ANO_MAX_ITBI = 2100;

// Nome original so para o registro: sem caminho, sem caracteres de
// controle/bidi, so caracteres comuns, ate 120.
export function sanitizarNomeArquivo(nome: string | undefined): string {
  const base = (nome ?? '').split(/[\\/]/).pop() ?? '';
  const limpo = base
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/[^\w .()\-À-ÿ]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return limpo || 'planilha.xlsx';
}

export interface ImportarItbiInput {
  requesterRole: string;
  requesterUserId: string;
  arquivo: { path: string; originalname: string; size: number } | undefined;
  ano: unknown;
}

@Injectable()
export class ImportarItbiUseCase {
  constructor(
    private readonly importador: ImportadorItbiService,
    @Inject(XLSX_INSPETOR) private readonly inspetor: IXlsxInspetor,
  ) {}

  // Dono do arquivo temporario: qualquer erro antes de entregar ao importador
  // apaga o arquivo aqui.
  async execute(input: ImportarItbiInput): Promise<{ importacaoId: string }> {
    const caminho = input.arquivo?.path;
    let entregue = false;
    try {
      exigirSuperUsuario(input.requesterRole);
      if (!input.arquivo || !caminho) throw new BadRequestException('Envie a planilha no campo "file".');
      await chmod(caminho, 0o600);
      if (!/\.xlsx$/i.test(input.arquivo.originalname ?? '')) {
        throw new BadRequestException('Envie a planilha no formato .xlsx (sem macros).');
      }
      const ano = Number(typeof input.ano === 'string' ? input.ano.trim() : input.ano);
      if (!Number.isInteger(ano) || ano < ANO_MIN_ITBI || ano > ANO_MAX_ITBI) {
        throw new BadRequestException('Informe o ano da planilha (ex.: 2026).');
      }
      if (!(await this.inspetor.temAssinaturaZip(caminho))) {
        throw new BadRequestException('O arquivo não é uma planilha .xlsx válida.');
      }
      try {
        await this.inspetor.inspecionar(caminho);
      } catch (erro) {
        throw new BadRequestException((erro as Error).message || 'O arquivo não é uma planilha .xlsx válida.');
      }
      entregue = true; // a partir daqui o importador apaga (inclusive no 409)
      return await this.importador.iniciar({
        caminho,
        nomeArquivo: sanitizarNomeArquivo(input.arquivo.originalname),
        ano,
        userId: input.requesterUserId,
      });
    } finally {
      if (!entregue && caminho) await unlink(caminho).catch(() => undefined);
    }
  }
}

@Injectable()
export class ListImportacoesItbiUseCase {
  constructor(@Inject(ITBI_IMPORTACAO_REPOSITORY) private readonly repo: IItbiImportacaoRepository) {}

  async execute(input: { requesterRole: string }) {
    exigirSuperUsuario(input.requesterRole);
    const lista = await this.repo.listar(50);
    return lista.map((i: ItbiImportacaoRegistro) => ({
      id: i.id,
      nomeArquivo: i.nomeArquivo,
      ano: i.ano,
      status: i.status,
      linhasLidas: i.linhasLidas,
      linhasInseridas: i.linhasInseridas,
      linhasDuplicadas: i.linhasDuplicadas,
      linhasDescartadas: i.linhasDescartadas,
      abas: i.abas,
      mensagemErro: i.mensagemErro,
      iniciadoEm: i.iniciadoEm.toISOString(),
      concluidoEm: i.concluidoEm ? i.concluidoEm.toISOString() : null,
    }));
  }
}

@Injectable()
export class IniciarGeocodificacaoItbiUseCase {
  constructor(private readonly job: GeocodificacaoItbiService) {}

  async execute(input: {
    requesterRole: string;
    ceps?: string[];
    bairros?: string[];
    max?: number;
  }): Promise<ProgressoGeocodificacao> {
    exigirSuperUsuario(input.requesterRole);
    const ceps = [...new Set((input.ceps ?? []).map((c) => c.trim()))];
    if (ceps.some((c) => !/^\d{5}$/.test(c))) {
      throw new BadRequestException('Use prefixos de CEP com 5 dígitos (ex.: 03277).');
    }
    const bairros = [...new Set((input.bairros ?? []).map((b) => normalizarBairro(b)).filter((b): b is string => !!b))];
    if (ceps.length === 0 && bairros.length === 0) {
      throw new BadRequestException('Informe ao menos um prefixo de CEP ou bairro.');
    }
    const max = input.max ?? GEOCODE_LOTE_PADRAO;
    if (!Number.isInteger(max) || max < 1 || max > GEOCODE_LOTE_MAX) {
      throw new BadRequestException(`O máximo deve ser entre 1 e ${GEOCODE_LOTE_MAX}.`);
    }
    return this.job.iniciar({ ceps, bairros, max });
  }
}

@Injectable()
export class GetGeocodificacaoItbiUseCase {
  constructor(private readonly job: GeocodificacaoItbiService) {}

  execute(input: { requesterRole: string }): { atual: ProgressoGeocodificacao | null } {
    exigirSuperUsuario(input.requesterRole);
    return { atual: this.job.status() };
  }
}
