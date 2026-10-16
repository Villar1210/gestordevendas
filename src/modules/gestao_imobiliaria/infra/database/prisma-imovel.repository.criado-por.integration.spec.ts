// Integracao (banco real, ver test/jest.setup.ts): coluna nova
// Imovel.criadoPorUserId (migration 20261016120000_imovel_criado_por) -
// gravada no create, devolvida no record, nunca trocada pelo update, e vira
// NULL quando o usuario e apagado (FK ON DELETE SET NULL). Pula sozinho sem
// banco (DATABASE_URL), mesmo padrao de prisma-empreendimento-book.repository.
// Revisao de seguranca: escrita condicional do nao-admin (update e fotos so
// gravam se ainda dono e nao publicado) e "publicar todas" ignorando imovel
// de corretor.
import { randomUUID } from 'crypto';
import type { PrismaImovelRepository } from './prisma-imovel.repository';
import { EdicaoImovelBloqueadaError } from '../../domain/repositories/imovel-repository.interface';

const temBanco = !!process.env.DATABASE_URL;
const descrever = temBanco ? describe : describe.skip;

descrever('PrismaImovelRepository.criadoPorUserId (integracao - banco real)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let repo: PrismaImovelRepository;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { PrismaService: Prisma } = require('../../../../config/prisma.service');
    const { PrismaImovelRepository: Repo } = require('./prisma-imovel.repository');
    /* eslint-enable @typescript-eslint/no-require-imports */
    prisma = new Prisma();
    repo = new Repo(prisma);
    tenantId = (await prisma.tenant.create({ data: { name: `Tenant CriadoPor ${Date.now()}` } })).id;
    const role = await prisma.role.create({ data: { tenantId, name: 'Corretor' } });
    userId = (
      await prisma.user.create({
        data: { tenantId, roleId: role.id, name: 'Corretor Teste', email: `criado-por-${randomUUID()}@teste.local`, password: 'x' },
      })
    ).id;
  }, 30000);

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('grava no create, mantem no update e vira NULL ao apagar o usuario', async () => {
    const criado = await repo.create({ tenantId, title: 'Casa do corretor', tipo: 'casa', finalidade: 'venda', criadoPorUserId: userId });
    expect(criado.criadoPorUserId).toBe(userId);
    expect(criado.publicado).toBe(false);

    const atualizado = await repo.update(criado.id, { title: 'Casa do corretor (editada)' });
    expect(atualizado.criadoPorUserId).toBe(userId);

    const semDono = await repo.create({ tenantId, title: 'Imovel antigo', tipo: 'casa', finalidade: 'venda' });
    expect(semDono.criadoPorUserId).toBeNull();

    await prisma.user.delete({ where: { id: userId } });
    const depois = await repo.findByIdAndTenant(criado.id, tenantId);
    expect(depois?.criadoPorUserId).toBeNull();
  });

  it('escrita condicional: dono nao publicado grava; publicado / outro usuario nao grava nada', async () => {
    const role = await prisma.role.findFirst({ where: { tenantId } });
    const dono = (
      await prisma.user.create({
        data: { tenantId, roleId: role.id, name: 'Dono', email: `dono-${randomUUID()}@teste.local`, password: 'x' },
      })
    ).id;
    const im = await repo.create({ tenantId, title: 'Original', tipo: 'casa', finalidade: 'venda', criadoPorUserId: dono });
    const cond = { tenantId, userId: dono };

    const ok = await repo.update(im.id, { title: 'Editado' }, cond);
    expect(ok.title).toBe('Editado');
    const foto = await repo.addPhoto({ tenantId, imovelId: im.id, url: '/uploads/imoveis/a.jpg', order: 0 }, cond);
    const foto2 = await repo.addPhoto({ tenantId, imovelId: im.id, url: '/uploads/imoveis/b.jpg', order: 1 }, cond);
    const reordenadas = await repo.reorderPhotos(im.id, [{ id: foto2.id, order: 0 }, { id: foto.id, order: 1 }], cond);
    expect(reordenadas.map((f) => f.id)).toEqual([foto2.id, foto.id]);

    // Outro usuario / outro tenant: nada muda.
    await expect(repo.update(im.id, { title: 'Hack' }, { tenantId, userId: randomUUID() })).rejects.toBeInstanceOf(EdicaoImovelBloqueadaError);
    await expect(repo.update(im.id, { title: 'Hack' }, { tenantId: randomUUID(), userId: dono })).rejects.toBeInstanceOf(EdicaoImovelBloqueadaError);

    // Publicado (admin publicou): update e as 3 operacoes de foto recusadas.
    await repo.update(im.id, { publicado: true });
    await expect(repo.update(im.id, { title: 'Depois' }, cond)).rejects.toBeInstanceOf(EdicaoImovelBloqueadaError);
    await expect(repo.addPhoto({ tenantId, imovelId: im.id, url: '/uploads/imoveis/c.jpg', order: 2 }, cond)).rejects.toBeInstanceOf(EdicaoImovelBloqueadaError);
    await expect(repo.deletePhoto(foto.id, { ...cond, imovelId: im.id })).rejects.toBeInstanceOf(EdicaoImovelBloqueadaError);
    await expect(repo.reorderPhotos(im.id, [{ id: foto.id, order: 0 }, { id: foto2.id, order: 1 }], cond)).rejects.toBeInstanceOf(EdicaoImovelBloqueadaError);

    const final = await repo.findByIdAndTenant(im.id, tenantId);
    expect(final?.title).toBe('Editado');
    const fotos = await repo.findPhotosByImovel(im.id);
    expect(fotos.map((f) => f.id)).toEqual([foto2.id, foto.id]);

    // Volta a nao publicado: delete condicional funciona e so apaga foto DESTE imovel.
    await repo.update(im.id, { publicado: false });
    await repo.deletePhoto(foto.id, { ...cond, imovelId: im.id });
    expect((await repo.findPhotosByImovel(im.id)).map((f) => f.id)).toEqual([foto2.id]);
  });

  it('setPublicadoPorEmpreendimento nunca publica imovel cadastrado por corretor', async () => {
    const emp = await prisma.empreendimento.create({
      data: { tenantId, name: 'Emp', rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', cep: '01000-000' },
    });
    const role = await prisma.role.findFirst({ where: { tenantId } });
    const corretor = (
      await prisma.user.create({
        data: { tenantId, roleId: role.id, name: 'C', email: `c-${randomUUID()}@teste.local`, password: 'x' },
      })
    ).id;
    const doAdmin = await repo.create({ tenantId, empreendimentoId: emp.id, title: 'U1', tipo: 'apartamento', finalidade: 'venda' });
    const doCorretor = await repo.create({ tenantId, empreendimentoId: emp.id, title: 'U2', tipo: 'apartamento', finalidade: 'venda', criadoPorUserId: corretor });

    expect(await repo.setPublicadoPorEmpreendimento(tenantId, emp.id, true)).toBe(1);
    expect((await repo.findByIdAndTenant(doAdmin.id, tenantId))?.publicado).toBe(true);
    expect((await repo.findByIdAndTenant(doCorretor.id, tenantId))?.publicado).toBe(false);
  });
});
