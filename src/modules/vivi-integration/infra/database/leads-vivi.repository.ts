// src/modules/vivi-integration/infra/database/leads-vivi.repository.ts
// Fatia 3 (WhatsApp do corretor): leitura dos leads que vieram da VIVI para
// a tela "Meus leads da VIVI" e registro do contato feito pelo corretor.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';

// Origens gravadas pelos fluxos da VIVI (agendar-visita / captura automatica).
export const ORIGENS_VIVI = ['roleta_online', 'captura_auto_vivi'];
export const TIPO_ATIVIDADE_WHATSAPP = 'whatsapp';

export interface LeadViviRecord {
  id: string;
  titulo: string;
  telefone: string | null;
  resumo: string | null;
  createdAt: Date;
  etapa: string | null;
  empreendimento: string | null;
  dono: { id: string; nome: string } | null;
  aguardandoAceite: boolean;
  atribuidoEm: Date | null;
  proximaVisita: Date | null;
  ultimoContatoEm: Date | null;
}

@Injectable()
export class LeadsViviRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(input: { tenantId: string; ownerId: string | null; limite: number }): Promise<LeadViviRecord[]> {
    const rows = await this.prisma.card.findMany({
      where: {
        tenantId: input.tenantId,
        origem: { in: ORIGENS_VIVI },
        ...(input.ownerId ? { ownerId: input.ownerId } : { ownerId: { not: null } }),
        NOT: { stage: { name: 'Fechamento' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: input.limite,
      select: {
        id: true,
        title: true,
        phone: true,
        description: true,
        createdAt: true,
        atribuidoAutomaticamenteEm: true,
        aceitoEm: true,
        stage: { select: { name: true } },
        owner: { select: { id: true, name: true } },
        empreendimento: { select: { name: true } },
        imovel: { select: { empreendimento: { select: { name: true } } } },
        activities: {
          where: { type: { in: ['visita', TIPO_ATIVIDADE_WHATSAPP] } },
          select: { type: true, scheduledAt: true, createdAt: true, done: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    const agora = Date.now();
    return rows.map((r) => {
      const visitas = r.activities
        .filter((a) => a.type === 'visita' && a.scheduledAt && !a.done)
        .map((a) => a.scheduledAt!.getTime());
      const futuras = visitas.filter((t) => t >= agora - 3 * 3600_000).sort((a, b) => a - b);
      const contato = r.activities.find((a) => a.type === TIPO_ATIVIDADE_WHATSAPP);
      return {
        id: r.id,
        titulo: r.title,
        telefone: r.phone,
        resumo: r.description,
        createdAt: r.createdAt,
        etapa: r.stage?.name ?? null,
        empreendimento: r.empreendimento?.name ?? r.imovel?.empreendimento?.name ?? null,
        dono: r.owner ? { id: r.owner.id, nome: r.owner.name } : null,
        aguardandoAceite: !!r.atribuidoAutomaticamenteEm && !r.aceitoEm,
        atribuidoEm: r.atribuidoAutomaticamenteEm,
        proximaVisita: futuras.length ? new Date(futuras[0]) : visitas.length ? new Date(Math.max(...visitas)) : null,
        ultimoContatoEm: contato?.createdAt ?? null,
      };
    });
  }

  async findCard(cardId: string, tenantId: string): Promise<{ id: string; ownerId: string | null; phone: string | null; origem: string } | null> {
    return this.prisma.card.findFirst({
      where: { id: cardId, tenantId },
      select: { id: true, ownerId: true, phone: true, origem: true },
    });
  }

  async registrarContatoWhatsapp(tenantId: string, cardId: string, nomeCorretor: string): Promise<Date> {
    const a = await this.prisma.activity.create({
      data: {
        tenantId,
        cardId,
        type: TIPO_ATIVIDADE_WHATSAPP,
        subject: `Contato pelo WhatsApp (${nomeCorretor}) - lead da VIVI`.slice(0, 200),
        done: true,
      },
      select: { createdAt: true },
    });
    await this.prisma.card.update({ where: { id: cardId }, data: { updatedAt: new Date() } });
    return a.createdAt;
  }

  async nomeUsuario(userId: string): Promise<string> {
    return (await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? 'Corretor';
  }
}
