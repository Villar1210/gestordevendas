// src/modules/rh/application/use-cases/rejeitar-cadastro.use-case.ts
import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  ICadastroRepository,
  CadastroRecord,
} from '../../domain/repositories/cadastro-repository.interface';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';

interface RejeitarCadastroInput {
  cadastroId: string;
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class RejeitarCadastroUseCase {
  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
  ) {}

  async execute(input: RejeitarCadastroInput): Promise<CadastroRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode rejeitar cadastros.');
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

    const rejeitado = await this.cadastroRepository.rejeitar(input.cadastroId);

    await this.emailSender.send({
      to: rejeitado.email,
      subject: 'Sobre o seu cadastro',
      body: `<p>Ola, ${rejeitado.name}.</p><p>Analisamos seu cadastro no gestordevendas e, no momento, nao foi possivel aprova-lo. Se tiver duvidas, entre em contato com a nossa equipe.</p>`,
    });

    return rejeitado;
  }
}
