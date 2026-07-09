// src/modules/rh/application/use-cases/aprovar-cadastro.use-case.ts
import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  ICadastroRepository,
  CadastroRecord,
} from '../../domain/repositories/cadastro-repository.interface';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';

const VALID_CARGOS_HIERARQUICOS = [
  'diretor',
  'superintendente',
  'gerente',
  'coordenador',
  'corretor',
];

interface AprovarCadastroInput {
  cadastroId: string;
  tenantId: string;
  requesterRole: string;
  cargoHierarquico?: string;
  superiorId?: string;
}

@Injectable()
export class AprovarCadastroUseCase {
  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
  ) {}

  async execute(input: AprovarCadastroInput): Promise<CadastroRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode aprovar cadastros.');
    }

    if (input.cargoHierarquico && !VALID_CARGOS_HIERARQUICOS.includes(input.cargoHierarquico)) {
      throw new BadRequestException(
        `Cargo hierarquico invalido. Use um destes: ${VALID_CARGOS_HIERARQUICOS.join(', ')}.`,
      );
    }

    const cadastro = await this.cadastroRepository.findByIdAndTenant(
      input.cadastroId,
      input.tenantId,
    );
    if (!cadastro) {
      throw new NotFoundException('Cadastro nao encontrado.');
    }
    if (cadastro.statusCadastro !== 'pendente_aprovacao') {
      throw new ConflictException('Este cadastro ja foi avaliado.');
    }

    const aprovado = await this.cadastroRepository.aprovar({
      id: input.cadastroId,
      cargoHierarquico: input.cargoHierarquico,
      superiorId: input.superiorId,
    });

    await this.emailSender.send({
      to: aprovado.email,
      subject: 'Seu cadastro foi aprovado!',
      body: `<p>Ola, ${aprovado.name}.</p><p>Seu cadastro no gestordevendas foi aprovado! Voce ja pode entrar no sistema com o e-mail e a senha que voce escolheu no cadastro.</p>`,
    });

    return aprovado;
  }
}
