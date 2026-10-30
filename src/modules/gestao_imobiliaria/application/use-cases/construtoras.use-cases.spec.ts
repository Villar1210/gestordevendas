// Construtoras (Fatia A): use cases do cadastro + resolucao da construtora
// do empreendimento (criar/editar/book), com repositorios FALSOS em memoria
// que respeitam tenantId como o Prisma (toda busca por { id, tenantId }).
import { BadRequestException, ConflictException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { UniqueConstraintViolationError } from '../../../../shared/domain/errors/unique-constraint-violation.error';
import {
  AtualizarConstrutoraDados,
  ConstrutoraRecord,
  CriarConstrutoraDados,
  IConstrutoraRepository,
} from '../../domain/repositories/construtora-repository.interface';
import {
  AtualizarConstrutoraUseCase,
  BuscarConstrutoraUseCase,
  CriarConstrutoraUseCase,
  EnviarLogoConstrutoraUseCase,
  ExcluirConstrutoraUseCase,
  ListarConstrutorasUseCase,
  RemoverLogoConstrutoraUseCase,
} from './construtoras.use-cases';
import { ResolverConstrutoraService } from '../services/resolver-construtora.service';
import { CreateEmpreendimentoUseCase } from './create-empreendimento.use-case';
import { UpdateEmpreendimentoUseCase } from './update-empreendimento.use-case';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0]);

interface EmpFalso {
  id: string;
  tenantId: string;
  construtoraId: string | null;
  construtora: string | null;
}

class RepositoriosFalsos {
  construtoras: ConstrutoraRecord[] = [];
  empreendimentos: EmpFalso[] = [];
  private seq = 0;
  // Simula a corrida "outro pedido criou entre o find e o create".
  corridaNoProximoCreate: ConstrutoraRecord | null = null;

  construtoraRepo: IConstrutoraRepository = {
    create: async (dados: CriarConstrutoraDados) => {
      if (this.corridaNoProximoCreate) {
        this.construtoras.push(this.corridaNoProximoCreate);
        this.corridaNoProximoCreate = null;
      }
      if (this.construtoras.some((c) => c.tenantId === dados.tenantId && c.nomeNormalizado === dados.nomeNormalizado)) {
        throw new UniqueConstraintViolationError();
      }
      const agora = new Date();
      const registro: ConstrutoraRecord = {
        id: `c-${++this.seq}`,
        tenantId: dados.tenantId,
        nome: dados.nome,
        nomeNormalizado: dados.nomeNormalizado,
        site: dados.site ?? null,
        sobre: dados.sobre ?? null,
        diferenciais: dados.diferenciais ?? null,
        logoUrl: null,
        createdAt: agora,
        updatedAt: agora,
      };
      this.construtoras.push(registro);
      return { ...registro };
    },
    findByIdAndTenant: async (id, tenantId) => {
      const c = this.construtoras.find((x) => x.id === id && x.tenantId === tenantId);
      return c ? { ...c, quantidadeEmpreendimentos: this.contar(id, tenantId) } : null;
    },
    findByNomeNormalizado: async (tenantId, nomeNormalizado) =>
      this.construtoras.find((x) => x.tenantId === tenantId && x.nomeNormalizado === nomeNormalizado) ?? null,
    findAllByTenant: async (tenantId) =>
      this.construtoras
        .filter((x) => x.tenantId === tenantId)
        .map((c) => ({ ...c, quantidadeEmpreendimentos: this.contar(c.id, tenantId) })),
    update: async (id, tenantId, dados: AtualizarConstrutoraDados) => {
      const c = this.construtoras.find((x) => x.id === id && x.tenantId === tenantId);
      if (!c) return null;
      if (
        dados.nomeNormalizado &&
        this.construtoras.some((x) => x.id !== id && x.tenantId === tenantId && x.nomeNormalizado === dados.nomeNormalizado)
      ) {
        throw new UniqueConstraintViolationError();
      }
      for (const [chave, valor] of Object.entries(dados)) {
        if (valor !== undefined) (c as unknown as Record<string, unknown>)[chave] = valor;
      }
      if (dados.nome !== undefined) {
        for (const e of this.empreendimentos) if (e.tenantId === tenantId && e.construtoraId === id) e.construtora = dados.nome;
      }
      return { ...c, quantidadeEmpreendimentos: this.contar(id, tenantId) };
    },
    countEmpreendimentos: async (id, tenantId) => this.contar(id, tenantId),
    deleteSemVinculo: async (id, tenantId) => {
      const indice = this.construtoras.findIndex((x) => x.id === id && x.tenantId === tenantId);
      if (indice < 0) return null;
      const vinculados = this.contar(id, tenantId);
      if (vinculados === 0) this.construtoras.splice(indice, 1);
      return { vinculados };
    },
  };

  empreendimentoRepo = {
    create: jest.fn(async (dados: Record<string, unknown>) => {
      const e = { id: `e-${++this.seq}`, ...dados } as unknown as EmpFalso;
      this.empreendimentos.push(e);
      return e;
    }),
    findByIdAndTenant: async (id: string, tenantId: string) =>
      this.empreendimentos.find((e) => e.id === id && e.tenantId === tenantId) ?? null,
    atualizarConstrutora: async (
      id: string,
      tenantId: string,
      dados: { construtoraId: string | null; construtora: string | null },
    ) => {
      const e = this.empreendimentos.find((x) => x.id === id && x.tenantId === tenantId);
      if (!e) return null;
      Object.assign(e, dados);
      return { ...e };
    },
  };

  private contar(id: string, tenantId: string) {
    return this.empreendimentos.filter((e) => e.tenantId === tenantId && e.construtoraId === id).length;
  }
}

function montar() {
  const r = new RepositoriosFalsos();
  const storage = { upload: jest.fn(async (f: { originalname: string }) => ({ url: `/uploads/imoveis/uuid-${f.originalname}` })) };
  const resolver = new ResolverConstrutoraService(r.construtoraRepo);
  return {
    r,
    storage,
    listar: new ListarConstrutorasUseCase(r.construtoraRepo),
    buscar: new BuscarConstrutoraUseCase(r.construtoraRepo),
    criar: new CriarConstrutoraUseCase(r.construtoraRepo),
    atualizar: new AtualizarConstrutoraUseCase(r.construtoraRepo),
    excluir: new ExcluirConstrutoraUseCase(r.construtoraRepo),
    enviarLogo: new EnviarLogoConstrutoraUseCase(r.construtoraRepo, storage as never),
    removerLogo: new RemoverLogoConstrutoraUseCase(r.construtoraRepo),
    criarEmpreendimento: new CreateEmpreendimentoUseCase(r.empreendimentoRepo as never, resolver),
    atualizarEmpreendimento: new UpdateEmpreendimentoUseCase(r.empreendimentoRepo as never, resolver),
    resolver,
  };
}

const DADOS_EMP = { name: 'Freguesia', rua: 'R', numero: '1', bairro: 'B', cidade: 'SP', uf: 'SP', cep: '00000-000' };

describe('Construtoras - cadastro', () => {
  it('cria com nome limpo e chave normalizada; site so https', async () => {
    const { criar } = montar();
    const c = await criar.execute({ tenantId: TENANT_A, nome: '  Novo   Lar ', site: 'https://novolar.com.br', sobre: '  ' });
    expect(c).toMatchObject({ nome: 'Novo Lar', nomeNormalizado: 'novo lar', site: 'https://novolar.com.br', sobre: null });
    await expect(criar.execute({ tenantId: TENANT_A, nome: 'X', site: 'http://x.com' })).rejects.toThrow(
      'O site da construtora deve começar com https://.',
    );
    await expect(criar.execute({ tenantId: TENANT_A, nome: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('nome repetido (normalizado) no mesmo tenant -> 409; em outro tenant pode', async () => {
    const { criar } = montar();
    await criar.execute({ tenantId: TENANT_A, nome: 'Novolar' });
    await expect(criar.execute({ tenantId: TENANT_A, nome: 'NOVOLAR ' })).rejects.toThrow(
      new ConflictException('Já existe uma construtora com esse nome.'),
    );
    await expect(criar.execute({ tenantId: TENANT_B, nome: 'Novolar' })).resolves.toMatchObject({ tenantId: TENANT_B });
  });

  it('corrida no create (unique do banco) tambem vira 409', async () => {
    const { criar, r } = montar();
    r.corridaNoProximoCreate = {
      id: 'c-corrida',
      tenantId: TENANT_A,
      nome: 'Novolar',
      nomeNormalizado: 'novolar',
      site: null,
      sobre: null,
      diferenciais: null,
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await expect(criar.execute({ tenantId: TENANT_A, nome: 'Novolar' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('isolamento: construtora de outro tenant = 404 em ler, editar, excluir e logo', async () => {
    const { criar, buscar, atualizar, excluir, enviarLogo, removerLogo, listar } = montar();
    const deA = await criar.execute({ tenantId: TENANT_A, nome: 'Novolar' });
    await expect(buscar.execute({ tenantId: TENANT_B, id: deA.id })).rejects.toBeInstanceOf(NotFoundException);
    await expect(atualizar.execute({ tenantId: TENANT_B, id: deA.id, sobre: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(excluir.execute({ tenantId: TENANT_B, id: deA.id })).rejects.toBeInstanceOf(NotFoundException);
    await expect(enviarLogo.execute({ tenantId: TENANT_B, id: deA.id, file: { buffer: JPEG } })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(removerLogo.execute({ tenantId: TENANT_B, id: deA.id })).rejects.toBeInstanceOf(NotFoundException);
    expect(await listar.execute({ tenantId: TENANT_B })).toEqual([]);
    expect(await buscar.execute({ tenantId: TENANT_A, id: deA.id })).toMatchObject({ nome: 'Novolar' });
  });

  it('editar: renomear para nome de outra -> 409; mesmo nome com outra caixa -> ok; texto do empreendimento acompanha', async () => {
    const { criar, atualizar, criarEmpreendimento, r } = montar();
    const novolar = await criar.execute({ tenantId: TENANT_A, nome: 'Novolar' });
    await criar.execute({ tenantId: TENANT_A, nome: 'Direcional' });
    await criarEmpreendimento.execute({ tenantId: TENANT_A, ...DADOS_EMP, construtoraId: novolar.id });

    await expect(atualizar.execute({ tenantId: TENANT_A, id: novolar.id, nome: 'direcional' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    const renomeada = await atualizar.execute({ tenantId: TENANT_A, id: novolar.id, nome: 'NovoLar', sobre: 'Sobre' });
    expect(renomeada).toMatchObject({ nome: 'NovoLar', sobre: 'Sobre' });
    expect(r.empreendimentos[0].construtora).toBe('NovoLar');
    await expect(atualizar.execute({ tenantId: TENANT_A, id: novolar.id, nome: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('excluir com empreendimento vinculado -> 409 com a quantidade; sem vinculo -> exclui', async () => {
    const { criar, excluir, criarEmpreendimento, atualizarEmpreendimento, listar } = montar();
    const c = await criar.execute({ tenantId: TENANT_A, nome: 'Novolar' });
    const e1 = await criarEmpreendimento.execute({ tenantId: TENANT_A, ...DADOS_EMP, construtoraId: c.id });
    await criarEmpreendimento.execute({ tenantId: TENANT_A, ...DADOS_EMP, construtoraId: c.id });

    await expect(excluir.execute({ tenantId: TENANT_A, id: c.id })).rejects.toThrow(
      new ConflictException('Esta construtora tem 2 empreendimentos. Troque a construtora deles antes de excluir.'),
    );

    await atualizarEmpreendimento.execute({ tenantId: TENANT_A, empreendimentoId: e1.id, construtoraId: null });
    await expect(excluir.execute({ tenantId: TENANT_A, id: c.id })).rejects.toThrow(
      'Esta construtora tem 1 empreendimento. Troque a construtora deles antes de excluir.',
    );
    const outra = await criar.execute({ tenantId: TENANT_A, nome: 'Sem vinculo' });
    await excluir.execute({ tenantId: TENANT_A, id: outra.id });
    expect((await listar.execute({ tenantId: TENANT_A })).map((x) => x.nome)).toEqual(['Novolar']);
  });

  it('logo: tipo pelos bytes, ate 2 MB, gravado como logo.<ext real>', async () => {
    const { criar, enviarLogo, removerLogo, storage } = montar();
    const c = await criar.execute({ tenantId: TENANT_A, nome: 'Novolar' });

    await expect(
      enviarLogo.execute({ tenantId: TENANT_A, id: c.id, file: { buffer: Buffer.from('<html><script>x</script></html>') } }),
    ).rejects.toThrow('Envie uma foto JPG, PNG ou WebP.');
    await expect(enviarLogo.execute({ tenantId: TENANT_A, id: c.id, file: undefined })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const grande = Buffer.alloc(2 * 1024 * 1024 + 1);
    JPEG.copy(grande);
    await expect(enviarLogo.execute({ tenantId: TENANT_A, id: c.id, file: { buffer: grande } })).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(storage.upload).not.toHaveBeenCalled();

    const comLogo = await enviarLogo.execute({ tenantId: TENANT_A, id: c.id, file: { buffer: JPEG } });
    expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ originalname: 'logo.jpg', mimetype: 'image/jpeg' }));
    expect(comLogo.logoUrl).toBe('/uploads/imoveis/uuid-logo.jpg');
    expect((await removerLogo.execute({ tenantId: TENANT_A, id: c.id })).logoUrl).toBeNull();
  });
});

describe('Construtoras - vinculo no empreendimento', () => {
  it('construtoraId de outro tenant -> 404 (nao cria o empreendimento)', async () => {
    const { criar, criarEmpreendimento, r } = montar();
    const deB = await criar.execute({ tenantId: TENANT_B, nome: 'Direcional' });
    await expect(
      criarEmpreendimento.execute({ tenantId: TENANT_A, ...DADOS_EMP, construtoraId: deB.id }),
    ).rejects.toThrow(new NotFoundException('Construtora não encontrada.'));
    expect(r.empreendimentoRepo.create).not.toHaveBeenCalled();
  });

  it('construtoraId do proprio tenant: texto legado = nome da construtora', async () => {
    const { criar, criarEmpreendimento } = montar();
    const c = await criar.execute({ tenantId: TENANT_A, nome: 'Novolar' });
    const e = await criarEmpreendimento.execute({
      tenantId: TENANT_A,
      ...DADOS_EMP,
      construtoraId: c.id,
      construtora: 'Outro texto qualquer',
    });
    expect(e).toMatchObject({ construtoraId: c.id, construtora: 'Novolar' });
  });

  it('so o texto: acha a existente pelo nome normalizado (sem duplicar)', async () => {
    const { criar, criarEmpreendimento, listar } = montar();
    const c = await criar.execute({ tenantId: TENANT_A, nome: 'Novolar' });
    const e = await criarEmpreendimento.execute({ tenantId: TENANT_A, ...DADOS_EMP, construtora: '  NOVOLAR ' });
    expect(e).toMatchObject({ construtoraId: c.id, construtora: 'Novolar' });
    expect(await listar.execute({ tenantId: TENANT_A })).toHaveLength(1);
  });

  it('so o texto (book): cria a construtora quando nao existe - no proprio tenant', async () => {
    const { criarEmpreendimento, listar } = montar();
    const e = await criarEmpreendimento.execute({ tenantId: TENANT_A, ...DADOS_EMP, construtora: ' Riva  Incorporadora ' });
    const lista = await listar.execute({ tenantId: TENANT_A });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nome: 'Riva Incorporadora', nomeNormalizado: 'riva incorporadora', quantidadeEmpreendimentos: 1 });
    expect(e).toMatchObject({ construtoraId: lista[0].id, construtora: 'Riva Incorporadora' });
    expect(await listar.execute({ tenantId: TENANT_B })).toEqual([]);
  });

  it('mesmo nome que ja existe em OUTRO tenant: cria uma nova no tenant certo', async () => {
    const { criar, criarEmpreendimento } = montar();
    const deB = await criar.execute({ tenantId: TENANT_B, nome: 'Novolar' });
    const e = await criarEmpreendimento.execute({ tenantId: TENANT_A, ...DADOS_EMP, construtora: 'Novolar' });
    expect(e.construtoraId).not.toBe(deB.id);
  });

  it('sem construtora nenhuma (ou texto vazio): sem vinculo', async () => {
    const { criarEmpreendimento } = montar();
    expect(await criarEmpreendimento.execute({ tenantId: TENANT_A, ...DADOS_EMP })).toMatchObject({
      construtoraId: null,
      construtora: null,
    });
    expect(await criarEmpreendimento.execute({ tenantId: TENANT_A, ...DADOS_EMP, construtora: '   ' })).toMatchObject({
      construtoraId: null,
      construtora: null,
    });
  });

  it('corrida no acha-ou-cria: devolve a que o outro pedido criou', async () => {
    const { resolver, r } = montar();
    r.corridaNoProximoCreate = {
      id: 'c-corrida',
      tenantId: TENANT_A,
      nome: 'Novolar',
      nomeNormalizado: 'novolar',
      site: null,
      sobre: null,
      diferenciais: null,
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await expect(resolver.resolver({ tenantId: TENANT_A, construtoraTexto: 'novolar' })).resolves.toEqual({
      construtoraId: 'c-corrida',
      construtora: 'Novolar',
    });
  });

  it('PATCH do empreendimento: troca, desvincula, 404 de outro tenant e sem campo nao mexe', async () => {
    const { criar, criarEmpreendimento, atualizarEmpreendimento } = montar();
    const a = await criar.execute({ tenantId: TENANT_A, nome: 'Novolar' });
    const b = await criar.execute({ tenantId: TENANT_A, nome: 'Direcional' });
    const deB = await criar.execute({ tenantId: TENANT_B, nome: 'Riva' });
    const e = await criarEmpreendimento.execute({ tenantId: TENANT_A, ...DADOS_EMP, construtoraId: a.id });

    expect(
      await atualizarEmpreendimento.execute({ tenantId: TENANT_A, empreendimentoId: e.id, construtoraId: b.id }),
    ).toMatchObject({ construtoraId: b.id, construtora: 'Direcional' });
    await expect(
      atualizarEmpreendimento.execute({ tenantId: TENANT_A, empreendimentoId: e.id, construtoraId: deB.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await atualizarEmpreendimento.execute({ tenantId: TENANT_A, empreendimentoId: e.id })).toMatchObject({
      construtoraId: b.id,
    });
    expect(
      await atualizarEmpreendimento.execute({ tenantId: TENANT_A, empreendimentoId: e.id, construtoraId: null }),
    ).toMatchObject({ construtoraId: null, construtora: null });
    // Empreendimento de outro tenant = 404.
    await expect(
      atualizarEmpreendimento.execute({ tenantId: TENANT_B, empreendimentoId: e.id, construtoraId: deB.id }),
    ).rejects.toThrow('Empreendimento nao encontrado.');
  });
});
