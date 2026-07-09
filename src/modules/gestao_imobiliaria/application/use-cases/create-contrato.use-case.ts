// src/modules/gestao_imobiliaria/application/use-cases/create-contrato.use-case.ts
// Ao criar um Contrato, o Imovel.status muda automaticamente: "vendido"
// (tipo=venda) ou "ocupado" (tipo=locacao). Proprietario e InquilinoComprador
// podem ser um ID existente OU dados para criar um novo na hora (o
// formulario do frontend permite "selecionar ou criar" os dois).
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IImovelRepository } from '../../domain/repositories/imovel-repository.interface';
import { IProprietarioRepository } from '../../domain/repositories/proprietario-repository.interface';
import { IInquilinoCompradorRepository } from '../../domain/repositories/inquilino-comprador-repository.interface';
import {
  ContratoRecord,
  IContratoRepository,
} from '../../domain/repositories/contrato-repository.interface';

interface NovoProprietarioInput {
  nome: string;
  telefone: string;
  cpfCnpj?: string;
  email?: string;
}

interface NovoInquilinoCompradorInput {
  nome: string;
  telefone: string;
  cpfCnpj?: string;
  email?: string;
}

interface CreateContratoInput {
  tenantId: string;
  imovelId: string;
  proprietarioId?: string;
  proprietario?: NovoProprietarioInput;
  inquilinoCompradorId?: string;
  inquilinoComprador?: NovoInquilinoCompradorInput;
  tipo: string;
  valor: number;
  dataInicio: Date;
  dataFim?: Date | null;
  diaVencimento?: number | null;
}

@Injectable()
export class CreateContratoUseCase {
  constructor(
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
    @Inject('IProprietarioRepository')
    private readonly proprietarioRepository: IProprietarioRepository,
    @Inject('IInquilinoCompradorRepository')
    private readonly inquilinoCompradorRepository: IInquilinoCompradorRepository,
    @Inject('IContratoRepository') private readonly contratoRepository: IContratoRepository,
  ) {}

  async execute(input: CreateContratoInput): Promise<ContratoRecord> {
    const imovel = await this.imovelRepository.findByIdAndTenant(input.imovelId, input.tenantId);
    if (!imovel) {
      throw new NotFoundException('Imovel nao encontrado.');
    }

    const proprietarioId = await this.resolveProprietarioId(input);
    const inquilinoCompradorId = await this.resolveInquilinoCompradorId(input);

    const contrato = await this.contratoRepository.create({
      tenantId: input.tenantId,
      imovelId: input.imovelId,
      proprietarioId,
      inquilinoCompradorId,
      tipo: input.tipo,
      valor: input.valor,
      dataInicio: input.dataInicio,
      dataFim: input.dataFim,
      diaVencimento: input.diaVencimento,
    });

    await this.imovelRepository.update(input.imovelId, {
      status: input.tipo === 'venda' ? 'vendido' : 'ocupado',
    });

    return contrato;
  }

  private async resolveProprietarioId(input: CreateContratoInput): Promise<string> {
    if (input.proprietarioId) {
      const proprietario = await this.proprietarioRepository.findByIdAndTenant(
        input.proprietarioId,
        input.tenantId,
      );
      if (!proprietario) {
        throw new NotFoundException('Proprietario nao encontrado.');
      }
      return proprietario.id;
    }

    if (!input.proprietario) {
      throw new BadRequestException(
        'Informe proprietarioId ou os dados de um novo proprietario.',
      );
    }

    const novoProprietario = await this.proprietarioRepository.create({
      tenantId: input.tenantId,
      ...input.proprietario,
    });
    return novoProprietario.id;
  }

  private async resolveInquilinoCompradorId(input: CreateContratoInput): Promise<string> {
    if (input.inquilinoCompradorId) {
      const inquilinoComprador = await this.inquilinoCompradorRepository.findByIdAndTenant(
        input.inquilinoCompradorId,
        input.tenantId,
      );
      if (!inquilinoComprador) {
        throw new NotFoundException('Inquilino/comprador nao encontrado.');
      }
      return inquilinoComprador.id;
    }

    if (!input.inquilinoComprador) {
      throw new BadRequestException(
        'Informe inquilinoCompradorId ou os dados de um novo inquilino/comprador.',
      );
    }

    const novoInquilinoComprador = await this.inquilinoCompradorRepository.create({
      tenantId: input.tenantId,
      ...input.inquilinoComprador,
    });
    return novoInquilinoComprador.id;
  }
}
