// src/modules/roleta_online/application/use-cases/salvar-roleta.use-case.ts
// Fatia 2 (Sorteio da vez): cria ou altera uma roleta (so Administrador).
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IRoletaRepository,
  RoletaRecord,
  TipoRoleta,
  ModoSorteio,
} from '../../domain/repositories/roleta-repository.interface';
import { horarioValido, SEGURANCA_MAX_MIN } from '../../domain/services/fila-sorteio';

export interface SalvarRoletaInput {
  tenantId: string;
  requesterRole: string;
  id?: string;
  nome: string;
  tipo: string;
  standId?: string | null;
  padrao?: boolean;
  ativa?: boolean;
  modoSorteio?: string;
  horariosSorteio?: string[];
  minutosSorteioSeguranca?: number;
  empreendimentoIds?: string[];
  corretorIds?: string[];
}

const MAX_HORARIOS = 6;

@Injectable()
export class SalvarRoletaUseCase {
  constructor(@Inject('IRoletaRepository') private readonly roletaRepository: IRoletaRepository) {}

  async execute(input: SalvarRoletaInput): Promise<RoletaRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode configurar as roletas.');
    }
    const nome = (input.nome ?? '').trim();
    if (nome.length < 2 || nome.length > 120) throw new BadRequestException('Informe o nome da roleta.');
    if (input.tipo !== 'stand' && input.tipo !== 'produto') {
      throw new BadRequestException('Tipo invalido. Use "stand" ou "produto".');
    }
    const tipo = input.tipo as TipoRoleta;
    const modo = (input.modoSorteio ?? 'automatico') as ModoSorteio;
    if (modo !== 'automatico' && modo !== 'botao') throw new BadRequestException('Modo de sorteio invalido.');

    const horarios = [...new Set((input.horariosSorteio ?? []).map((h) => h.trim()))].sort();
    if (horarios.some((h) => !horarioValido(h))) throw new BadRequestException('Horario invalido. Use HH:MM (ex.: 09:00).');
    if (horarios.length > MAX_HORARIOS) throw new BadRequestException(`No maximo ${MAX_HORARIOS} horarios por dia.`);

    const seguranca = input.minutosSorteioSeguranca ?? 15;
    if (!Number.isInteger(seguranca) || seguranca < 5 || seguranca > SEGURANCA_MAX_MIN) {
      throw new BadRequestException(`Sorteio de seguranca precisa ser entre 5 e ${SEGURANCA_MAX_MIN} minutos.`);
    }

    let standId: string | null = null;
    if (tipo === 'stand') {
      if (!input.standId || !(await this.roletaRepository.existeStand(input.tenantId, input.standId))) {
        throw new BadRequestException('Escolha o stand desta roleta.');
      }
      standId = input.standId;
    }

    const dados = {
      nome,
      tipo,
      standId,
      padrao: !!input.padrao,
      ativa: input.ativa !== false,
      modoSorteio: modo,
      horariosSorteio: horarios,
      minutosSorteioSeguranca: seguranca,
    };

    let roleta: RoletaRecord;
    if (input.id) {
      const atual = await this.roletaRepository.findById(input.id, input.tenantId);
      if (!atual) throw new NotFoundException('Roleta nao encontrada.');
      roleta = await this.roletaRepository.update(input.id, input.tenantId, dados);
    } else {
      roleta = await this.roletaRepository.create(input.tenantId, dados);
    }

    if (dados.padrao) await this.roletaRepository.limparPadrao(input.tenantId, roleta.id);

    if (tipo === 'produto') {
      const emps = await this.roletaRepository.filtrarEmpreendimentosDoTenant(input.tenantId, input.empreendimentoIds ?? []);
      const corr = await this.roletaRepository.filtrarUsuariosDoTenant(input.tenantId, input.corretorIds ?? []);
      await this.roletaRepository.setEmpreendimentos(roleta.id, emps);
      await this.roletaRepository.setCorretores(roleta.id, corr);
    } else {
      // Roleta de stand: participantes vem da escala de plantao.
      await this.roletaRepository.setEmpreendimentos(roleta.id, []);
      await this.roletaRepository.setCorretores(roleta.id, []);
    }
    return (await this.roletaRepository.findById(roleta.id, input.tenantId))!;
  }
}
