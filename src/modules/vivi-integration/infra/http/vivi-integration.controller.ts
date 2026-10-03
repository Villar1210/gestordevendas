import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ViviApiKeyGuard } from './vivi-api-key.guard';
import { AgendarVisitaViviDto } from './dto/agendar-visita.dto';
import { AgendarVisitaUseCase } from '../../../vivi_sdr/application/use-cases/agendar-visita.use-case';
import { PrismaService } from '../../../../config/prisma.service';
import { ChatwootWhatsappService } from '../../services/chatwoot-whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { FollowUpService } from '../../../follow-up/follow-up.service';
import { MoverCardViviDto } from './dto/mover-card.dto';
import { MoverCardViviUseCase } from '../../application/use-cases/mover-card-vivi.use-case';
import { SimularCreditoDto } from './dto/simular-credito.dto';
import { SimularCreditoUseCase } from '../../application/use-cases/simular-credito.use-case';
import { montarAvisoAgendamento, normalizarTelefoneBR } from '../../services/aviso-agendamento';

// Etiqueta aplicada no Chatwoot as conversas de aviso ao corretor, para
// separar visualmente dos leads na caixa da VIVI.
const ETIQUETA_AVISO_CORRETOR = 'aviso-corretor';

@Controller('vivi')
@UseGuards(ViviApiKeyGuard)
export class ViviIntegrationController {
  private readonly logger = new Logger(ViviIntegrationController.name);

  constructor(
    private readonly agendarVisitaUseCase: AgendarVisitaUseCase,
    private readonly prisma: PrismaService,
    private readonly chatwoot: ChatwootWhatsappService,
    private readonly config: ConfigService,
    private readonly followUpService: FollowUpService,
    private readonly moverCardViviUseCase: MoverCardViviUseCase,
    private readonly simularCreditoUseCase: SimularCreditoUseCase,
  ) {}

  @Get('empreendimentos')
  async listarEmpreendimentos() {
    const tenantId = this.config.get<string>('VIVI_TENANT_ID');

    const empreendimentos = await this.prisma.empreendimento.findMany({
      where: { tenantId, publicado: true },
      select: {
        id: true,
        name: true,
        description: true,
        bairro: true,
        cidade: true,
        uf: true,
        imoveis: {
          select: { id: true, tipo: true, area: true, price: true, status: true },
          where: { status: 'DISPONIVEL' },
          take: 5,
        },
      },
      orderBy: { name: 'asc' },
    });

    return empreendimentos;
  }

  @Post('agendar-visita')
  @HttpCode(HttpStatus.CREATED)
  async agendarVisita(@Body() dto: AgendarVisitaViviDto) {
    const tenantId = this.config.get<string>('VIVI_TENANT_ID');

    this.logger.log(
      `VIVI agendando visita — cliente: ${dto.phoneNumber}, data: ${dto.dataVisita} ${dto.horario}`,
    );

    const resultado = await this.agendarVisitaUseCase.execute({
      tenantId: tenantId ?? '',
      phoneNumber: dto.phoneNumber,
      dataVisita: dto.dataVisita,
      horario: dto.horario,
      empreendimentoId: dto.empreendimentoId,
      existingCardId: dto.existingCardId,
      resumo: dto.resumo,
    });

    if (!resultado) {
      // Empresa sem funil configurado (AgendarVisitaUseCase ja registrou o
      // erro no log). Antes estourava "Cannot read properties of null" (500).
      throw new UnprocessableEntityException('Nao foi possivel registrar a visita: empresa sem funil de vendas configurado.');
    }

    // Corretor dono do card (ownerId = atribuicao confirmada pela Roleta,
    // modo automatico). Antes buscava na tabela "atendimento" (modelo
    // errado, sem relacao "corretor") - o erro era engolido pelo .catch e o
    // corretor NUNCA era avisado. Sem ownerId (Roleta desligada ou
    // semi_automatico) nao ha para quem avisar.
    let corretor: { nome: string; telefone: string } | null = null;

    if (resultado?.cardId) {
      const card = await this.prisma.card
        .findFirst({
          where: { id: resultado.cardId, tenantId: tenantId ?? '' },
          select: { owner: { select: { name: true, whatsapp: true, telefone: true } } },
        })
        .catch((err: Error) => {
          this.logger.error(`Falha ao buscar o corretor do card ${resultado.cardId}: ${err.message}`);
          return null;
        });

      const owner = card?.owner;
      const telefone = normalizarTelefoneBR(owner?.whatsapp || owner?.telefone);
      if (owner && telefone) {
        corretor = { nome: owner.name, telefone };
      } else if (owner) {
        this.logger.warn(`Card ${resultado.cardId}: corretor "${owner.name}" sem WhatsApp/telefone valido no cadastro - aviso nao enviado.`);
      } else {
        this.logger.log(`Card ${resultado.cardId} ainda sem corretor definido - aviso de agendamento nao enviado.`);
      }
    }

    if (corretor) {
      // Nao aguarda: o envio (e a checagem de entrega) nao pode atrasar a
      // resposta para a VIVI. Falhas ficam registradas no log pelo servico.
      this.chatwoot
        .enviarMensagem({
          telefone: corretor.telefone,
          nomeContato: corretor.nome,
          mensagem: montarAvisoAgendamento({
            nomeCliente: dto.nomeCliente,
            phoneNumber: dto.phoneNumber,
            dataVisita: dto.dataVisita,
            horario: dto.horario,
            resumo: dto.resumo,
          }),
          etiquetas: [ETIQUETA_AVISO_CORRETOR],
          verificarEntrega: true,
        })
        .catch(() => {});
    }

    return {
      cardId: resultado!.cardId,
      visitaAgendadaEm: resultado!.visitaAgendadaEm,
      mensagemConfirmacao: resultado?.mensagemConfirmacaoEstruturada,
      corretor,
    };
  }

  @Post('notificar-corretor')
  @HttpCode(HttpStatus.NO_CONTENT)
  async notificarCorretor(
    @Body() body: { telefoneCorretor: string; nomeCorretor?: string; mensagem: string },
  ) {
    await this.chatwoot.enviarMensagem({
      telefone: body.telefoneCorretor,
      nomeContato: body.nomeCorretor,
      mensagem: body.mensagem,
    });
  }

  @Post('mover-card')
  @HttpCode(HttpStatus.OK)
  async moverCard(@Body() dto: MoverCardViviDto) {
    const tenantId = this.config.get<string>('VIVI_TENANT_ID') ?? '';
    return this.moverCardViviUseCase.execute({
      cardId: dto.cardId,
      tenantId,
      stageName: dto.stageName,
      motivoRepique: dto.motivoRepique,
    });
  }
  @Get('simular-credito')
  @HttpCode(HttpStatus.OK)
  async simularCredito(@Query() dto: SimularCreditoDto) {
    return this.simularCreditoUseCase.execute({
      renda: Number(dto.renda),
      idade: Number(dto.idade),
      temDependente: dto.temDependente === true || (dto.temDependente as any) === 'true',
    });
  }



  @Get('trigger-followup-test')
  async triggerFollowupTest() {
    await this.followUpService.verificarFollowUps();
    return { ok: true };
  }
}
