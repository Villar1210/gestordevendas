// src/modules/gestao_imobiliaria/application/use-cases/construtoras.use-cases.ts
// Cadastro de Construtoras (Fatia A - docs/construtoras/CONTRATO_CONSTRUTORAS.md).
// Leitura: qualquer role do dashboard (guard). Escrita e logo: so
// Administrador (classe do ConstrutoraController + meta-teste). Toda
// operacao por { id, tenantId }: construtora de outro tenant = 404, igual a
// inexistente.
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { UniqueConstraintViolationError } from '../../../../shared/domain/errors/unique-constraint-violation.error';
import { IFileStorageService } from '../../../../shared/domain/services/file-storage.interface';
import {
  AtualizarConstrutoraDados,
  ConstrutoraRecord,
  IConstrutoraRepository,
} from '../../domain/repositories/construtora-repository.interface';
import {
  CONSTRUTORA_LOGO_MAX_BYTES,
  CONSTRUTORA_NOME_MAX,
  MENSAGEM_CONSTRUTORA_DUPLICADA,
  MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA,
  MENSAGEM_CONSTRUTORA_NOME_OBRIGATORIO,
  MENSAGEM_CONSTRUTORA_SITE_INVALIDO,
  limparNomeConstrutora,
  mensagemConstrutoraComVinculo,
  normalizarNomeConstrutora,
  siteValido,
  textoOuNull,
} from '../../domain/services/construtora';
import { MENSAGEM_FOTO_INVALIDA, detectarTipoFoto } from '../../domain/services/foto-upload';

export interface DadosConstrutoraInput {
  nome?: string;
  site?: string | null;
  sobre?: string | null;
  diferenciais?: string | null;
}

function nomeValidado(nome: string | undefined): string {
  const limpo = limparNomeConstrutora(nome ?? '');
  if (!limpo) throw new BadRequestException(MENSAGEM_CONSTRUTORA_NOME_OBRIGATORIO);
  if (limpo.length > CONSTRUTORA_NOME_MAX) {
    throw new BadRequestException(`O nome da construtora deve ter no máximo ${CONSTRUTORA_NOME_MAX} caracteres.`);
  }
  return limpo;
}

function siteValidado(site: string | null | undefined): string | null | undefined {
  if (site === undefined) return undefined;
  const limpo = textoOuNull(site);
  if (limpo && !siteValido(limpo)) throw new BadRequestException(MENSAGEM_CONSTRUTORA_SITE_INVALIDO);
  return limpo;
}

function opcional(valor: string | null | undefined): string | null | undefined {
  return valor === undefined ? undefined : textoOuNull(valor);
}

@Injectable()
export class ListarConstrutorasUseCase {
  constructor(@Inject('IConstrutoraRepository') private readonly repo: IConstrutoraRepository) {}

  async execute(input: { tenantId: string }): Promise<ConstrutoraRecord[]> {
    return this.repo.findAllByTenant(input.tenantId);
  }
}

@Injectable()
export class BuscarConstrutoraUseCase {
  constructor(@Inject('IConstrutoraRepository') private readonly repo: IConstrutoraRepository) {}

  async execute(input: { tenantId: string; id: string }): Promise<ConstrutoraRecord> {
    const construtora = await this.repo.findByIdAndTenant(input.id, input.tenantId);
    if (!construtora) throw new NotFoundException(MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA);
    return construtora;
  }
}

@Injectable()
export class CriarConstrutoraUseCase {
  constructor(@Inject('IConstrutoraRepository') private readonly repo: IConstrutoraRepository) {}

  async execute(input: { tenantId: string } & DadosConstrutoraInput): Promise<ConstrutoraRecord> {
    const nome = nomeValidado(input.nome);
    const nomeNormalizado = normalizarNomeConstrutora(nome);
    if (await this.repo.findByNomeNormalizado(input.tenantId, nomeNormalizado)) {
      throw new ConflictException(MENSAGEM_CONSTRUTORA_DUPLICADA);
    }
    try {
      const criada = await this.repo.create({
        tenantId: input.tenantId,
        nome,
        nomeNormalizado,
        site: siteValidado(input.site) ?? null,
        sobre: opcional(input.sobre) ?? null,
        diferenciais: opcional(input.diferenciais) ?? null,
      });
      return { ...criada, quantidadeEmpreendimentos: 0 };
    } catch (error) {
      if (error instanceof UniqueConstraintViolationError) throw new ConflictException(MENSAGEM_CONSTRUTORA_DUPLICADA);
      throw error;
    }
  }
}

@Injectable()
export class AtualizarConstrutoraUseCase {
  constructor(@Inject('IConstrutoraRepository') private readonly repo: IConstrutoraRepository) {}

  async execute(input: { tenantId: string; id: string } & DadosConstrutoraInput): Promise<ConstrutoraRecord> {
    const atual = await this.repo.findByIdAndTenant(input.id, input.tenantId);
    if (!atual) throw new NotFoundException(MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA);

    const dados: AtualizarConstrutoraDados = {
      site: siteValidado(input.site),
      sobre: opcional(input.sobre),
      diferenciais: opcional(input.diferenciais),
    };
    if (input.nome !== undefined) {
      const nome = nomeValidado(input.nome);
      const nomeNormalizado = normalizarNomeConstrutora(nome);
      const outra = await this.repo.findByNomeNormalizado(input.tenantId, nomeNormalizado);
      if (outra && outra.id !== atual.id) throw new ConflictException(MENSAGEM_CONSTRUTORA_DUPLICADA);
      dados.nome = nome;
      dados.nomeNormalizado = nomeNormalizado;
    }

    try {
      const atualizada = await this.repo.update(input.id, input.tenantId, dados);
      if (!atualizada) throw new NotFoundException(MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA);
      return atualizada;
    } catch (error) {
      if (error instanceof UniqueConstraintViolationError) throw new ConflictException(MENSAGEM_CONSTRUTORA_DUPLICADA);
      throw error;
    }
  }
}

@Injectable()
export class ExcluirConstrutoraUseCase {
  constructor(@Inject('IConstrutoraRepository') private readonly repo: IConstrutoraRepository) {}

  // Decisao do Villar (30/10/2026): com empreendimento vinculado, BLOQUEIA.
  async execute(input: { tenantId: string; id: string }): Promise<void> {
    const resultado = await this.repo.deleteSemVinculo(input.id, input.tenantId);
    if (!resultado) throw new NotFoundException(MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA);
    if (resultado.vinculados > 0) {
      throw new ConflictException(mensagemConstrutoraComVinculo(resultado.vinculados));
    }
  }
}

// Logo: tipo REAL pelos bytes (JPG/PNG/WebP, mesma regra das fotos), ate
// 2 MB, gravado como "<uuid>-logo.<ext real>" (o nome enviado pelo usuario
// nunca vai para o disco - /uploads e publico). O arquivo anterior NAO e
// apagado do disco (mesmo comportamento ja aceito para fotos removidas -
// o LocalFileStorageService.delete so apaga arquivos do book).
@Injectable()
export class EnviarLogoConstrutoraUseCase {
  constructor(
    @Inject('IConstrutoraRepository') private readonly repo: IConstrutoraRepository,
    @Inject('IFileStorageService') private readonly fileStorage: IFileStorageService,
  ) {}

  async execute(input: {
    tenantId: string;
    id: string;
    file: { buffer?: Buffer; size?: number } | null | undefined;
  }): Promise<ConstrutoraRecord> {
    const atual = await this.repo.findByIdAndTenant(input.id, input.tenantId);
    if (!atual) throw new NotFoundException(MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA);

    const buffer = input.file?.buffer;
    if (buffer && buffer.length > CONSTRUTORA_LOGO_MAX_BYTES) {
      throw new PayloadTooLargeException('O logo deve ter no máximo 2 MB.');
    }
    const tipo = detectarTipoFoto(buffer);
    if (!buffer || !tipo) throw new BadRequestException(MENSAGEM_FOTO_INVALIDA);

    const { url } = await this.fileStorage.upload({
      buffer,
      originalname: `logo.${tipo.extensao}`,
      mimetype: tipo.mimetype,
    });
    const atualizada = await this.repo.update(input.id, input.tenantId, { logoUrl: url });
    if (!atualizada) throw new NotFoundException(MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA);
    return atualizada;
  }
}

@Injectable()
export class RemoverLogoConstrutoraUseCase {
  constructor(@Inject('IConstrutoraRepository') private readonly repo: IConstrutoraRepository) {}

  async execute(input: { tenantId: string; id: string }): Promise<ConstrutoraRecord> {
    const atualizada = await this.repo.update(input.id, input.tenantId, { logoUrl: null });
    if (!atualizada) throw new NotFoundException(MENSAGEM_CONSTRUTORA_NAO_ENCONTRADA);
    return atualizada;
  }
}
