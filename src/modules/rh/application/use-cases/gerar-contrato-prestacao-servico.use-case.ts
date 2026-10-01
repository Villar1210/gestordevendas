// src/modules/rh/application/use-cases/gerar-contrato-prestacao-servico.use-case.ts
// Chamado por AprovarCadastroUseCase logo apos a aprovacao ja ter sido
// persistida (fora de qualquer transacao - geracao de PDF e criacao de
// envelope sao I/O, nao devem segurar lock de banco). Falha aqui NAO
// desfaz a aprovacao ja concluida - o chamador so loga o erro, mesmo
// padrao ja usado em GenerateSignedPdfUseCase (modulo edoc).
import { Injectable, Inject } from '@nestjs/common';
import {
  CadastroRecord,
  ICadastroRepository,
} from '../../domain/repositories/cadastro-repository.interface';
import { ITenantConfigRepository } from '../../../configuracoes/domain/repositories/tenant-config-repository.interface';
import { preencherContratoTemplate } from '../../domain/services/preencher-contrato-template';
import { ehPessoaJuridica } from '../../domain/services/roles-com-contrato';
import { formatarEnderecoTenant } from '../../domain/services/formatar-endereco-tenant';
import { GetOrCreateContratoTemplateUseCase } from './get-or-create-contrato-template.use-case';
import { GerarPdfContratoService } from '../services/gerar-pdf-contrato.service';
import { CreateEnvelopeUseCase } from '../../../edoc/application/use-cases/create-envelope.use-case';
import { SendEnvelopeUseCase } from '../../../edoc/application/use-cases/send-envelope.use-case';
import { GetContratoParceriaConfigUseCase } from './get-contrato-parceria-config.use-case';
import { montarSignatariosContrato } from '../../domain/services/signatarios-contrato';

interface GerarContratoPrestacaoServicoInput {
  cadastro: CadastroRecord;
  createdByUserId: string;
}

@Injectable()
export class GerarContratoPrestacaoServicoUseCase {
  constructor(
    @Inject('ITenantConfigRepository') private readonly tenantConfigRepository: ITenantConfigRepository,
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
    private readonly getOrCreateContratoTemplateUseCase: GetOrCreateContratoTemplateUseCase,
    private readonly gerarPdfContratoService: GerarPdfContratoService,
    private readonly createEnvelopeUseCase: CreateEnvelopeUseCase,
    private readonly sendEnvelopeUseCase: SendEnvelopeUseCase,
    private readonly getContratoParceriaConfigUseCase: GetContratoParceriaConfigUseCase,
  ) {}

  async execute(input: GerarContratoPrestacaoServicoInput): Promise<void> {
    const { cadastro } = input;

    const template = await this.getOrCreateContratoTemplateUseCase.execute({
      tenantId: cadastro.tenantId,
    });

    // Razao social/CNPJ/endereco da empresa (CONTRATANTE), preenchidos pelo
    // Administrador em /dashboard/configuracoes (modulo configuracoes) -
    // podem estar em branco se ninguem preencheu ainda, o contrato so sai
    // com "nao informado" nesse caso (nao bloqueia a aprovacao do cadastro
    // do corretor, diferente da checagem de CPF/CRECI dele mesmo).
    const tenantConfig = await this.tenantConfigRepository.findByTenantId(cadastro.tenantId);
    const nomeTenant = tenantConfig?.name ?? 'a empresa contratante';
    const cnpjTenant = tenantConfig?.cnpj ?? 'não informado';
    const enderecoTenant = tenantConfig
      ? formatarEnderecoTenant(tenantConfig)
      : 'endereço não informado';

    // "Imobiliaria Parceira" e pessoa juridica - usa nomeImobiliaria/cnpj
    // no lugar do nome/creci pessoais (ambos preenchidos no placeholder
    // generico {{NOME}}/{{CRECI}} do template, ver preencher-contrato-template.ts).
    const pessoaJuridica = ehPessoaJuridica(cadastro.roleName);
    const nomeContratado = pessoaJuridica ? cadastro.nomeImobiliaria ?? cadastro.name : cadastro.name;
    const registroProfissional = pessoaJuridica ? cadastro.cnpj ?? '' : cadastro.creci ?? '';

    const corpoPreenchido = preencherContratoTemplate(template.corpo, {
      nomeTenant,
      cnpjTenant,
      enderecoTenant,
      nome: nomeContratado,
      cpf: cadastro.cpf ?? '',
      creci: registroProfissional,
      endereco: cadastro.endereco ?? 'não informado',
      cep: cadastro.cep ?? 'não informado',
      dataAtual: new Date().toLocaleDateString('pt-BR'),
    });

    // Quem assina (contratado, representante da empresa, testemunhas) vem da
    // configuracao da empresa - sem configuracao, so o contratado (original).
    const config = await this.getContratoParceriaConfigUseCase.execute(cadastro.tenantId);
    const signatarios = montarSignatariosContrato(
      config,
      {
        nome: nomeContratado,
        email: cadastro.email,
        documento: pessoaJuridica
          ? cadastro.cnpj ? `CNPJ ${cadastro.cnpj}` : null
          : cadastro.cpf ? `CPF ${cadastro.cpf}` : null,
      },
      nomeTenant,
    );

    // Pagina final de assinaturas com 1 quadro por signatario - o PDF devolve
    // a posicao exata de cada campo (antes era uma posicao fixa estimada).
    const { buffer, campos } = await this.gerarPdfContratoService.execute({
      titulo: template.nome,
      corpo: corpoPreenchido,
      assinaturas: signatarios.map((s) => ({ rotulo: s.rotulo, nome: s.name, detalhe: s.detalhe })),
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
      recipients: signatarios.map((s) => ({ name: s.name, email: s.email, role: s.role })),
      fields: campos.map((campo, recipientIndex) => ({
        recipientIndex,
        tipo: 'assinatura' as const,
        ...campo,
      })),
    });

    await this.sendEnvelopeUseCase.execute({
      envelopeId: result.envelope.id,
      tenantId: cadastro.tenantId,
    });

    // Vincula o envelope ao User (rastreamento visivel na aba "Aprovados"
    // da tela de Aprovacoes) - depois do envio, ja que so importa se todo
    // o resto deu certo.
    await this.cadastroRepository.updateContratoEnvelopeId(cadastro.id, result.envelope.id);

    // So bloqueia depois que o contrato saiu de verdade - se algo acima
    // falhar, o corretor nunca fica trancado sem ter o que assinar.
    if (config.bloquearAcessoAteAssinar) {
      await this.cadastroRepository.setAguardandoAssinaturaContrato(cadastro.id, true);
    }
  }
}
