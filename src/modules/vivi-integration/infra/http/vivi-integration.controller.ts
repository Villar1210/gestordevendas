import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
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

    let corretor: { nome: string; telefone: string } | null = null;

    if (resultado!.cardId) {
      const card = await (this.prisma as any).atendimento.findUnique({
        where: { id: resultado!.cardId },
        include: { corretor: { select: { name: true, phone: true } } },
      }).catch(() => null);

      if (card?.corretor) {
        corretor = {
          nome: card?.corretor?.name ?? '',
          telefone: card?.corretor?.phone?.replace(/\D/g, '') || '',
        };
      }
    }

    if (corretor?.telefone) {
      const dataFormatada = new Date(dto.dataVisita).toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: '2-digit',
      });

      this.chatwoot.enviarMensagem({
        telefone: corretor.telefone,
        nomeContato: corretor.nome,
        mensagem:
          `🏠 *Novo agendamento via VIVI!*\n\n` +
          `👤 Cliente: ${dto.nomeCliente || dto.phoneNumber}\n` +
          `📱 WhatsApp: +${dto.phoneNumber}\n` +
          `📅 Data: ${dataFormatada} às ${dto.horario}\n` +
          (dto.resumo ? `📝 Perfil: ${dto.resumo}\n` : '') +
          `\nAcesse o CRM: https://gestordevendas.ivillar.com.br`,
      }).catch(() => {});
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

  @Get('trigger-followup-test')
  async triggerFollowupTest() {
    await this.followUpService.verificarFollowUps();
    return { ok: true };
  }
}
