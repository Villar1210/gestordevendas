// src/modules/portal_cliente/application/use-cases/get-meus-imoveis.use-case.ts
// Vinculo por E-MAIL (nao por FK formal) - ver CLAUDE.md, secao Portal do
// Cliente, sobre a limitacao dessa correspondencia.
import { Injectable, Inject } from '@nestjs/common';
import { IProprietarioRepository } from '../../../gestao_imobiliaria/domain/repositories/proprietario-repository.interface';
import { IContratoRepository } from '../../../gestao_imobiliaria/domain/repositories/contrato-repository.interface';
import { IImovelRepository } from '../../../gestao_imobiliaria/domain/repositories/imovel-repository.interface';

interface GetMeusImoveisInput {
  tenantId: string;
  email: string;
}

export interface MeuImovelResult {
  contratoId: string;
  contratoTipo: string;
  contratoStatus: string;
  imovelId: string;
  imovelTitle: string;
  imovelEndereco: string;
  imovelStatus: string;
  coverPhotoUrl: string | null;
}

@Injectable()
export class GetMeusImoveisUseCase {
  constructor(
    @Inject('IProprietarioRepository') private readonly proprietarioRepository: IProprietarioRepository,
    @Inject('IContratoRepository') private readonly contratoRepository: IContratoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: GetMeusImoveisInput): Promise<MeuImovelResult[]> {
    const proprietario = await this.proprietarioRepository.findByTenantAndEmail(
      input.tenantId,
      input.email,
    );
    if (!proprietario) {
      return [];
    }

    const contratos = await this.contratoRepository.findAllByTenant(input.tenantId, {
      proprietarioId: proprietario.id,
    });

    const resultados: MeuImovelResult[] = [];
    for (const contrato of contratos) {
      const imovel = await this.imovelRepository.findByIdAndTenant(
        contrato.imovelId,
        input.tenantId,
      );
      if (!imovel) continue; // dado inconsistente - protege sem travar o resto da lista

      const photos = await this.imovelRepository.findPhotosByImovel(imovel.id);
      const coverPhoto = [...photos].sort((a, b) => a.order - b.order)[0] ?? null;

      resultados.push({
        contratoId: contrato.id,
        contratoTipo: contrato.tipo,
        contratoStatus: contrato.status,
        imovelId: imovel.id,
        imovelTitle: imovel.title,
        imovelEndereco: [imovel.rua, imovel.numero, imovel.bairro, imovel.cidade]
          .filter(Boolean)
          .join(', '),
        imovelStatus: imovel.status,
        coverPhotoUrl: coverPhoto?.url ?? null,
      });
    }

    return resultados;
  }
}
