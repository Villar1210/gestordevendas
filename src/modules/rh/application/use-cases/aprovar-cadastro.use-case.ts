// src/modules/rh/application/use-cases/aprovar-cadastro.use-case.ts
import {
  Injectable,
  Inject,
  Logger,
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
import { exigeContrato, ehPessoaJuridica } from '../../domain/services/roles-com-contrato';
import { GerarContratoPrestacaoServicoUseCase } from './gerar-contrato-prestacao-servico.use-case';

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
  // Usado como createdByUserId do envelope de contrato de prestacao de
  // servico (ver GerarContratoPrestacaoServicoUseCase) - so quando a
  // aprovacao gera contrato (exigeContrato).
  requesterUserId: string;
  cargoHierarquico?: string;
  superiorId?: string;
}

@Injectable()
export class AprovarCadastroUseCase {
  private readonly logger = new Logger(AprovarCadastroUseCase.name);

  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
    private readonly gerarContratoPrestacaoServicoUseCase: GerarContratoPrestacaoServicoUseCase,
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

    // Corretor/Corretor Parceiro/Imobiliaria Parceira prestam servico para
    // a imobiliaria - a aprovacao gera automaticamente um contrato de
    // prestacao de servico (ver GerarContratoPrestacaoServicoUseCase), que
    // precisa do documento de identificacao profissional preenchido.
    // Bloqueia a aprovacao (em vez de gerar com dado em branco) para nunca
    // sair um contrato incompleto - "Cliente" nao passa por essa checagem,
    // nao presta servico.
    if (exigeContrato(cadastro.roleName)) {
      if (!cadastro.cpf) {
        throw new BadRequestException(
          'CPF e obrigatorio para gerar o contrato de prestacao de servico - peca ao cadastrado para completar o CPF antes de aprovar.',
        );
      }
      if (ehPessoaJuridica(cadastro.roleName)) {
        if (!cadastro.cnpj) {
          throw new BadRequestException(
            'CNPJ e obrigatorio para gerar o contrato de prestacao de servico - peca para completar o CNPJ antes de aprovar.',
          );
        }
      } else if (!cadastro.creci) {
        throw new BadRequestException(
          'CRECI e obrigatorio para gerar o contrato de prestacao de servico - peca para completar o CRECI antes de aprovar.',
        );
      }
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

    // Geracao do contrato e um efeito colateral POS-aprovacao - uma falha
    // aqui (PDF, envio de e-mail do envelope, etc.) nunca desfaz a
    // aprovacao ja concluida, so fica registrada no log (mesmo padrao ja
    // usado em GenerateSignedPdfUseCase/DistributeLeadUseCase).
    if (exigeContrato(aprovado.roleName)) {
      try {
        await this.gerarContratoPrestacaoServicoUseCase.execute({
          cadastro: aprovado,
          createdByUserId: input.requesterUserId,
        });
      } catch (error) {
        this.logger.error(
          `Falha ao gerar contrato de prestacao de servico para o cadastro ${aprovado.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    return aprovado;
  }
}
