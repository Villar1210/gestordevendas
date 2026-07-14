// src/modules/rh/application/use-cases/gerar-contrato-prestacao-servico.use-case.ts
// Chamado por AprovarCadastroUseCase logo apos a aprovacao ja ter sido
// persistida (fora de qualquer transacao - geracao de PDF e criacao de
// envelope sao I/O, nao devem segurar lock de banco). Falha aqui NAO
// desfaz a aprovacao ja concluida - o chamador so loga o erro, mesmo
// padrao ja usado em GenerateSignedPdfUseCase (modulo edoc).
import { Injectable, Inject } from '@nestjs/common';
import { CadastroRecord } from '../../domain/repositories/cadastro-repository.interface';
import { ITenantRepository } from '../../domain/repositories/tenant-repository.interface';
import { preencherContratoTemplate } from '../../domain/services/preencher-contrato-template';
import { ehPessoaJuridica } from '../../domain/services/roles-com-contrato';
import { GetOrCreateContratoTemplateUseCase } from './get-or-create-contrato-template.use-case';
import { GerarPdfContratoService } from '../services/gerar-pdf-contrato.service';
import { CreateEnvelopeUseCase } from '../../../edoc/application/use-cases/create-envelope.use-case';
import { SendEnvelopeUseCase } from '../../../edoc/application/use-cases/send-envelope.use-case';

interface GerarContratoPrestacaoServicoInput {
  cadastro: CadastroRecord;
  createdByUserId: string;
}

// Posicao fixa do campo de assinatura na ULTIMA pagina - o documento e
// gerado por nos mesmos (nao e um upload arbitrario de terceiro), entao
// sabemos que o bloco de assinatura do CONTRATADO(A) sempre fica na
// porcao inferior da pagina (ver contrato-template-padrao.ts, termina com
// as linhas de assinatura). Nao tenta alinhar pixel-a-pixel com o texto -
// suficiente para o modelo de teste desta fatia.
const CAMPO_ASSINATURA_X_PERCENT = 0.55;
const CAMPO_ASSINATURA_Y_PERCENT = 0.85;
const CAMPO_ASSINATURA_WIDTH_PERCENT = 0.35;
const CAMPO_ASSINATURA_HEIGHT_PERCENT = 0.06;

@Injectable()
export class GerarContratoPrestacaoServicoUseCase {
  constructor(
    @Inject('ITenantRepository') private readonly tenantRepository: ITenantRepository,
    private readonly getOrCreateContratoTemplateUseCase: GetOrCreateContratoTemplateUseCase,
    private readonly gerarPdfContratoService: GerarPdfContratoService,
    private readonly createEnvelopeUseCase: CreateEnvelopeUseCase,
    private readonly sendEnvelopeUseCase: SendEnvelopeUseCase,
  ) {}

  async execute(input: GerarContratoPrestacaoServicoInput): Promise<void> {
    const { cadastro } = input;

    const template = await this.getOrCreateContratoTemplateUseCase.execute({
      tenantId: cadastro.tenantId,
    });

    // Tenant hoje nao tem CNPJ/endereco proprios (ver ITenantRepository) -
    // so o nome esta disponivel para qualificar o CONTRATANTE.
    const nomeTenant = (await this.tenantRepository.findNameById(cadastro.tenantId)) ?? 'a empresa contratante';

    // "Imobiliaria Parceira" e pessoa juridica - usa nomeImobiliaria/cnpj
    // no lugar do nome/creci pessoais (ambos preenchidos no placeholder
    // generico {{NOME}}/{{CRECI}} do template, ver preencher-contrato-template.ts).
    const pessoaJuridica = ehPessoaJuridica(cadastro.roleName);
    const nomeContratado = pessoaJuridica ? cadastro.nomeImobiliaria ?? cadastro.name : cadastro.name;
    const registroProfissional = pessoaJuridica ? cadastro.cnpj ?? '' : cadastro.creci ?? '';

    const corpoPreenchido = preencherContratoTemplate(template.corpo, {
      nomeTenant,
      nome: nomeContratado,
      cpf: cadastro.cpf ?? '',
      creci: registroProfissional,
      endereco: cadastro.endereco ?? 'não informado',
      cep: cadastro.cep ?? 'não informado',
      dataAtual: new Date().toLocaleDateString('pt-BR'),
    });

    const { buffer, pageCount } = await this.gerarPdfContratoService.execute({
      titulo: template.nome,
      corpo: corpoPreenchido,
    });

    const result = await this.createEnvelopeUseCase.execute({
      tenantId: cadastro.tenantId,
      createdByUserId: input.createdByUserId,
      title: template.nome,
      file: {
        buffer,
        originalname: `contrato-${cadastro.id}.pdf`,
        mimetype: 'application/pdf',
      },
      recipients: [{ name: nomeContratado, email: cadastro.email, role: 'destinatario' }],
      fields: [
        {
          recipientIndex: 0,
          tipo: 'assinatura',
          pageNumber: pageCount,
          xPercent: CAMPO_ASSINATURA_X_PERCENT,
          yPercent: CAMPO_ASSINATURA_Y_PERCENT,
          widthPercent: CAMPO_ASSINATURA_WIDTH_PERCENT,
          heightPercent: CAMPO_ASSINATURA_HEIGHT_PERCENT,
        },
      ],
    });

    await this.sendEnvelopeUseCase.execute({
      envelopeId: result.envelope.id,
      tenantId: cadastro.tenantId,
    });
  }
}
