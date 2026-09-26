// src/modules/gestao_imobiliaria/application/use-cases/publicar-unidades-no-site.use-case.ts
// "Publicar no site" em massa: liga/desliga todas as unidades de um
// empreendimento de uma vez (um lancamento tem centenas de unidades - uma
// por uma e inviavel). A vitrine so mostra as que estiverem DISPONIVEIS,
// entao unidade vendida/reservada marcada aqui continua fora do site ate
// voltar a ficar disponivel.
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IEmpreendimentoRepository } from '../../domain/repositories/empreendimento-repository.interface';
import { IImovelRepository } from '../../domain/repositories/imovel-repository.interface';

@Injectable()
export class PublicarUnidadesNoSiteUseCase {
  constructor(
    @Inject('IEmpreendimentoRepository')
    private readonly empreendimentoRepository: IEmpreendimentoRepository,
    @Inject('IImovelRepository') private readonly imovelRepository: IImovelRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    empreendimentoId: string;
    publicado: boolean;
  }): Promise<{ atualizadas: number }> {
    const empreendimento = await this.empreendimentoRepository.findByIdAndTenant(
      input.empreendimentoId,
      input.tenantId,
    );
    if (!empreendimento) throw new NotFoundException('Empreendimento não encontrado.');

    const atualizadas = await this.imovelRepository.setPublicadoPorEmpreendimento(
      input.tenantId,
      input.empreendimentoId,
      input.publicado,
    );
    return { atualizadas };
  }
}
