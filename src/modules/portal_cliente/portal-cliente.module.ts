// src/modules/portal_cliente/portal-cliente.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GestaoImobiliariaModule } from '../gestao_imobiliaria/gestao-imobiliaria.module';
import { VendasKanbanModule } from '../vendas_kanban/vendas-kanban.module';
import { EdocModule } from '../edoc/edoc.module';
import { PortalClienteController } from './infra/http/portal-cliente.controller';
import { GetMeusImoveisUseCase } from './application/use-cases/get-meus-imoveis.use-case';
import { GetMeuAtendimentoUseCase } from './application/use-cases/get-meu-atendimento.use-case';
import { GetMinhasAssinaturasPendentesUseCase } from './application/use-cases/get-minhas-assinaturas-pendentes.use-case';
import { GetMeusDocumentosAssinadosUseCase } from './application/use-cases/get-meus-documentos-assinados.use-case';

@Module({
  // Dependencia de modulo (nao circular): portal_cliente so LE dados ja
  // expostos por auth (IUserRepository), gestao_imobiliaria
  // (IProprietarioRepository/IContratoRepository/IImovelRepository),
  // vendas_kanban (ICardRepository) e edoc (ISignatureRecipientRepository).
  // Nenhum desses modulos conhece portal_cliente de volta (mesmo padrao do
  // roleta_online consumindo vendas_kanban + rh).
  imports: [AuthModule, GestaoImobiliariaModule, VendasKanbanModule, EdocModule],
  controllers: [PortalClienteController],
  providers: [
    GetMeusImoveisUseCase,
    GetMeuAtendimentoUseCase,
    GetMinhasAssinaturasPendentesUseCase,
    GetMeusDocumentosAssinadosUseCase,
  ],
})
export class PortalClienteModule {}
