// src/modules/rh/application/use-cases/registrar-atividade.use-case.ts
// Presenca automatica (Fatia 1 - Atendimento/Roleta): "sinal de vida" do
// usuario logado, chamado pela Topbar a cada 60s enquanto o CRM estiver
// aberto (mesmo em aba de fundo). Se o navegador fechar ou o PC dormir, os
// sinais param e MarcarInativosOfflineUseCase derruba o usuario para
// "offline" - assim a Roleta deixa de entregar lead para quem nao esta la.
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ICorretorRepository } from '../../domain/repositories/corretor-repository.interface';

@Injectable()
export class RegistrarAtividadeUseCase {
  constructor(
    @Inject('ICorretorRepository') private readonly corretorRepository: ICorretorRepository,
  ) {}

  async execute(input: { userId: string; tenantId: string }): Promise<{ statusDisponibilidade: string }> {
    const status = await this.corretorRepository.registrarAtividade(input.userId, input.tenantId);
    if (status === null) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    return { statusDisponibilidade: status };
  }
}
