// RH - cadastro completo da equipe interna (25/11/2026): fluxo com banco real.
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { FichaCadastralRepository } from '../../infra/database/ficha-cadastral.repository';
import { CadastroEquipeUseCases } from './cadastro-equipe.use-cases';
import type { CadastroEquipeDto } from '../../infra/http/dtos/cadastro-equipe.dto';

describe('Cadastro da equipe (integracao)', () => {
  let prisma: PrismaService;
  let uc: CadastroEquipeUseCases;
  let tenantId: string;
  let gerenteId: string;
  let regionalId: string;
  let adminId: string;
  const emit = jest.fn();
  const sufixo = Date.now();

  const ficha = (o: Partial<CadastroEquipeDto> = {}): CadastroEquipeDto =>
    ({
      indicadoPor: 'Carla Mendes',
      cargo: 'Corretor Imobiliário',
      jaTrabalhouNoGrupo: false,
      superiorId: gerenteId,
      nome: 'Ana Paula Ribeiro',
      rg: '123456789',
      rgUf: 'SP',
      cpf: String(sufixo).slice(-11).padStart(11, '1'),
      nomeMae: 'Maria Ribeiro',
      nomePai: 'José Ribeiro',
      dataNascimento: '1992-03-14',
      paisNascimento: 'Brasil',
      estadoNascimento: 'São Paulo',
      cidadeNascimento: 'Santo André',
      estadoCivil: 'Solteiro(a)',
      nomeConjuge: 'nao deve gravar',
      quantidadeFilhos: 'Nenhum',
      email: `Ana.${sufixo}@Teste.local`,
      telefone: '11987654321',
      rua: 'Rua das Acácias',
      numero: '120',
      bairro: 'Vila Ema',
      cidade: 'São Paulo',
      cep: '03277000',
      escolaridade: 'Ensino Superior Completo',
      possuiCreci: true,
      creciTipo: 'Definitivo',
      creciNumero: '123456-F',
      creciValidade: '2099-03-31',
      banco: 'Itaú',
      agencia: '1234',
      conta: '12345-6',
      tipoConta: 'Corrente',
      tipoPix: 'CPF',
      chavePix: '12345678909',
      optaPj: false,
      tamanhoCamisa: 'M',
      senha: 'senha-forte-1',
      aceiteLgpd: true,
      ...o,
    }) as CadastroEquipeDto;

  beforeAll(async () => {
    prisma = new PrismaService();
    tenantId = (await prisma.tenant.create({ data: { name: 'Tenant Teste Cadastro Equipe' } })).id;
    process.env.PUBLIC_SIGNUP_TENANT_ID = tenantId;
    const roleId = (await prisma.role.create({ data: { tenantId, name: 'Corretor' } })).id;
    const adminRole = (await prisma.role.create({ data: { tenantId, name: 'Administrador' } })).id;
    const mk = (name: string, cargo: string | null, rId = roleId) =>
      prisma.user.create({ data: { tenantId, roleId: rId, name, email: `${name.replace(/ /g, '')}.${sufixo}@t.local`, password: 'x', cargoHierarquico: cargo } });
    gerenteId = (await mk('Rafael Nogueira', 'gerente')).id;
    regionalId = (await mk('Sonia Prado', 'gerente_regional')).id;
    await mk('Pedro Pendente', 'gerente').then((u) => prisma.user.update({ where: { id: u.id }, data: { statusCadastro: 'pendente_aprovacao' } }));
    adminId = (await mk('Admin', null, adminRole)).id;
    const roles = {
      findByTenantAndName: async (t: string, n: string) => prisma.role.findFirst({ where: { tenantId: t, name: n } }),
      create: async (d: { tenantId: string; name: string }) => prisma.role.create({ data: d }),
    };
    uc = new CadastroEquipeUseCases(new FichaCadastralRepository(prisma), roles as never, { emit } as never);
  }, 30000);

  afterAll(async () => {
    await prisma.fichaAcessoSensivel.deleteMany({ where: { titular: { tenantId } } });
    await prisma.fichaCadastral.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    delete process.env.PUBLIC_SIGNUP_TENANT_ID;
    await prisma.$disconnect();
  }, 30000);

  it('lista de superiores muda conforme o cargo e so traz aprovados', async () => {
    const corretor = await uc.superioresParaCargo('Corretor Imobiliário');
    expect(corretor).toEqual({ pergunta: 'Quem é o seu gerente?', superiores: [{ id: gerenteId, nome: 'Rafael Nogueira' }] });
    const gerente = await uc.superioresParaCargo('Gerente de Vendas');
    expect(gerente.pergunta).toMatch(/superintendente ou gerente regional/);
    expect(gerente.superiores).toEqual([{ id: regionalId, nome: 'Sonia Prado' }]);
    await expect(uc.superioresParaCargo('Presidente')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ficha vira cadastro pendente com a ficha completa; RH ve na lista e na ficha mascarada', async () => {
    const r = await uc.enviarFicha(ficha());
    expect(r.message).toMatch(/Cadastro recebido/);
    const u = await prisma.user.findFirst({ where: { tenantId, email: `ana.${sufixo}@teste.local` }, include: { fichaCadastral: true } });
    expect(u).toMatchObject({ statusCadastro: 'pendente_aprovacao', cargoNaEmpresa: 'Corretor Imobiliário', creci: '123456-F' });
    expect(u!.fichaCadastral).toMatchObject({ superiorIndicadoId: gerenteId, nomeConjuge: null, possuiCreci: true });
    expect(u!.fichaCadastral!.aceiteLgpdEm).toBeInstanceOf(Date);
    expect(emit).toHaveBeenCalledWith('cadastro.pendente.criado', expect.objectContaining({ cadastroId: u!.id }));

    const lista = await uc.listar(tenantId, 'pendente');
    expect(lista.contagem.pendente).toBe(1);
    expect(lista.cadastros[0]).toMatchObject({
      nome: 'Ana Paula Ribeiro',
      cargo: 'Corretor Imobiliário',
      superior: { id: gerenteId, nome: 'Rafael Nogueira' },
      creci: { situacao: 'ok' },
    });

    const f = await uc.ficha(tenantId, u!.id);
    expect(f.pagamento).toMatchObject({ banco: 'Itaú', conta: '•••45-6', chavePix: '••••••78909', mascarado: true });
    expect(f.aprovacaoSugerida).toEqual({ cargoHierarquico: 'corretor', superioresPermitidos: ['gerente'] });
    expect(f.acessosAosDadosBancarios).toEqual([]);

    const aberto = await uc.revelarPagamento(tenantId, u!.id, adminId);
    expect(aberto).toMatchObject({ conta: '12345-6', chavePix: '12345678909', mascarado: false });
    expect((await uc.ficha(tenantId, u!.id)).acessosAosDadosBancarios).toEqual([{ quem: 'Admin', em: expect.any(Date) }]);
  });

  it('recusa: mesmo e-mail/CPF, superior fora da lista (pendente ou cargo errado)', async () => {
    await expect(uc.enviarFicha(ficha())).rejects.toBeInstanceOf(ConflictException);
    await expect(uc.enviarFicha(ficha({ email: `outro.${sufixo}@t.local` }))).rejects.toThrow(/CPF/);
    await expect(uc.enviarFicha(ficha({ email: `x.${sufixo}@t.local`, cpf: '98765432100', superiorId: regionalId }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('sem superior: recusa se ha nomes para escolher; aceita se ainda nao ha ninguem com o cargo', async () => {
    await expect(
      uc.enviarFicha(ficha({ email: `semsup.${sufixo}@t.local`, cpf: '98765432101', superiorId: undefined })),
    ).rejects.toThrow(/superior/);
    // Gerente Regional responde a superintendente/diretor: ninguem assim no tenant de teste.
    await uc.enviarFicha(
      ficha({ cargo: 'Gerente Regional', email: `reg.${sufixo}@t.local`, cpf: '98765432102', superiorId: undefined }),
    );
    const u = await prisma.user.findFirstOrThrow({ where: { email: `reg.${sufixo}@t.local` }, include: { fichaCadastral: true } });
    expect(u.fichaCadastral!.superiorIndicadoId).toBeNull();
    expect((await uc.ficha(tenantId, u.id)).superior).toBeNull();
  });

  it('motivo da recusa fica na ficha', async () => {
    const u = await prisma.user.findFirstOrThrow({ where: { tenantId, fichaCadastral: { isNot: null } } });
    await uc.registrarMotivoRecusa(u.id, '  CRECI não confere  ');
    await uc.registrarMotivoRecusa(u.id, '   ');
    expect((await prisma.fichaCadastral.findUniqueOrThrow({ where: { userId: u.id } })).motivoRecusa).toBe('CRECI não confere');
  });
});
