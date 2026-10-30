// Permissoes da area Imoveis (16/10/2026) - teste HTTP por TABELA, com o
// RolesGuard REAL (so o JwtAuthGuard e trocado por um fake que monta
// req.user a partir do header x-perfil). Use cases das regras R1/R2 sao os
// REAIS (com repositorios falsos); o resto e mockado. Inclui o META-TESTE:
// percorre o metadata de roles de TODAS as rotas destes controllers e exige
// que qualquer rota fora da lista liberada seja so Administrador (rota nova
// esquecida falha aqui). Ver CLAUDE.md, "Permissoes da area Imoveis e WhatsApp".
import { CanActivate, ExecutionContext, INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { ImovelController } from './imovel.controller';
import { EmpreendimentoController } from './empreendimento.controller';
import { ContratoController } from './contrato.controller';
import { ConstrutoraController } from './construtora.controller';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { ROLES_KEY } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { CreateImovelUseCase } from '../../application/use-cases/create-imovel.use-case';
import { UpdateImovelUseCase } from '../../application/use-cases/update-imovel.use-case';
import { AlterarStatusImovelUseCase } from '../../application/use-cases/alterar-status-imovel.use-case';
import { UploadImovelPhotoUseCase } from '../../application/use-cases/upload-imovel-photo.use-case';
import { DeleteImovelPhotoUseCase } from '../../application/use-cases/delete-imovel-photo.use-case';
import { ReorderImovelPhotosUseCase } from '../../application/use-cases/reorder-imovel-photos.use-case';
import { CreateContratoUseCase } from '../../application/use-cases/create-contrato.use-case';
import { EncerrarContratoUseCase } from '../../application/use-cases/encerrar-contrato.use-case';

jest.setTimeout(60_000);

const TENANT = '11111111-1111-4111-8111-111111111111';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0]);
const EMP = '22222222-2222-4222-8222-222222222222';
const CONS = '33333333-3333-4333-8333-333333333333';
// Imoveis do repositorio falso: do corretor (nao publicado), do corretor ja
// publicado, e antigo/sem dono (= do Administrador).
const IM_COR = 'im-do-corretor';
const IM_PUB = 'im-publicado';
const IM_ADM = 'im-sem-dono';

const PERFIS = {
  admin: { id: 'u-admin', role: 'Administrador', cargo: null },
  corretor: { id: 'u-corretor', role: 'Corretor', cargo: 'corretor' },
  gerente: { id: 'u-gerente', role: 'Corretor', cargo: 'gerente' },
  coordenador: { id: 'u-coord', role: 'Corretor', cargo: 'coordenador' },
  parceiro: { id: 'u-parceiro', role: 'Corretor Parceiro', cargo: null },
} as const;
type Perfil = keyof typeof PERFIS;
const TODOS = Object.keys(PERFIS) as Perfil[];

class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const p = PERFIS[req.headers['x-perfil'] as Perfil];
    req.user = { ...p, tenantId: TENANT, standId: null, impersonadoPor: null };
    return true;
  }
}

function imovelFalso(id: string) {
  return {
    id,
    tenantId: TENANT,
    status: 'disponivel',
    criadoPorUserId: id === IM_ADM ? null : 'u-corretor',
    publicado: id === IM_PUB,
  };
}

const imovelRepository = {
  create: jest.fn(async (d: Record<string, unknown>) => ({ id: 'novo', ...d })),
  update: jest.fn(async (id: string, d: Record<string, unknown>) => ({ ...imovelFalso(id), ...d })),
  findByIdAndTenant: jest.fn(async (id: string) => imovelFalso(id)),
  findPhotosByImovel: jest.fn(async () => [{ id: 'f-1' }, { id: 'f-2' }]),
  addPhoto: jest.fn(async (d: Record<string, unknown>) => ({ id: 'f-novo', ...d })),
  findPhotoByIdAndTenant: jest.fn(async (photoId: string) => ({ id: photoId, imovelId: IM_COR, tenantId: TENANT })),
  deletePhoto: jest.fn(async () => undefined),
  reorderPhotos: jest.fn(async () => []),
};
const repositoriosFalsos: Record<string, unknown> = {
  IImovelRepository: imovelRepository,
  IEmpreendimentoRepository: { findByIdAndTenant: async () => ({ id: EMP }) },
  IProprietarioRepository: { findByIdAndTenant: async () => ({ id: 'p-1' }), create: async () => ({ id: 'p-1' }) },
  IInquilinoCompradorRepository: { findByIdAndTenant: async () => ({ id: 'i-1' }), create: async () => ({ id: 'i-1' }) },
  IContratoRepository: {
    create: async (d: Record<string, unknown>) => ({ id: 'c-1', ...d }),
    findByIdAndTenant: async () => ({ id: 'c-1', imovelId: IM_ADM, tipo: 'venda', status: 'ativo' }),
    updateStatus: async () => ({ id: 'c-1', status: 'encerrado' }),
  },
  IFileStorageService: { upload: jest.fn(async () => ({ url: '/uploads/x.jpg' })) },
};
// Resposta generica dos use cases mockados (cobre o zip do book).
const RESPOSTA_MOCK = { ok: true, nomeArquivo: 'book.zip', zip: Buffer.from('PK') };

interface Rota {
  nome: string;
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  body?: unknown;
  arquivo?: boolean;
  // perfis que PASSAM (status < 400); os demais tem de receber 403.
  passam: readonly Perfil[];
}

const ADMIN: readonly Perfil[] = ['admin'];
const GESTAO: readonly Perfil[] = ['admin', 'gerente', 'coordenador'];
const DONO: readonly Perfil[] = ['admin', 'corretor'];

const ROTAS: Rota[] = [
  // ImovelController
  { nome: 'ImovelController.list', metodo: 'GET', url: '/imoveis', passam: TODOS },
  { nome: 'ImovelController.get', metodo: 'GET', url: `/imoveis/${IM_ADM}`, passam: TODOS },
  { nome: 'ImovelController.create', metodo: 'POST', url: '/imoveis', body: { title: 'Casa', tipo: 'casa', finalidade: 'venda' }, passam: TODOS },
  { nome: 'ImovelController.update', metodo: 'PATCH', url: `/imoveis/${IM_COR}`, body: { title: 'x' }, passam: DONO },
  { nome: 'ImovelController.update (publicado)', metodo: 'PATCH', url: `/imoveis/${IM_PUB}`, body: { title: 'x' }, passam: ADMIN },
  { nome: 'ImovelController.update (sem dono)', metodo: 'PATCH', url: `/imoveis/${IM_ADM}`, body: { title: 'x' }, passam: ADMIN },
  { nome: 'ImovelController.update (status pelo cadastro)', metodo: 'PATCH', url: `/imoveis/${IM_COR}`, body: { status: 'vendido' }, passam: ADMIN },
  { nome: 'ImovelController.updateStatus', metodo: 'PATCH', url: `/imoveis/${IM_ADM}/status`, body: { status: 'reservado' }, passam: GESTAO },
  { nome: 'ImovelController.uploadPhoto', metodo: 'POST', url: `/imoveis/${IM_COR}/photos`, arquivo: true, passam: DONO },
  { nome: 'ImovelController.uploadPhoto (publicado)', metodo: 'POST', url: `/imoveis/${IM_PUB}/photos`, arquivo: true, passam: ADMIN },
  { nome: 'ImovelController.deletePhoto', metodo: 'DELETE', url: `/imoveis/${IM_COR}/photos/f-1`, passam: DONO },
  { nome: 'ImovelController.reorderPhotos', metodo: 'PATCH', url: `/imoveis/${IM_COR}/photos/reorder`, body: { photoIds: ['f-2', 'f-1'] }, passam: DONO },
  // ContratoController
  { nome: 'ContratoController.list', metodo: 'GET', url: '/contratos', passam: TODOS },
  { nome: 'ContratoController.get', metodo: 'GET', url: '/contratos/c-1', passam: TODOS },
  {
    nome: 'ContratoController.create',
    metodo: 'POST',
    url: '/contratos',
    body: { imovelId: IM_ADM, proprietarioId: 'p-1', inquilinoCompradorId: 'i-1', tipo: 'venda', valor: 100, dataInicio: '2026-10-16' },
    passam: GESTAO,
  },
  { nome: 'ContratoController.encerrar', metodo: 'POST', url: '/contratos/c-1/encerrar', passam: GESTAO },
  // EmpreendimentoController
  { nome: 'EmpreendimentoController.list', metodo: 'GET', url: '/empreendimentos', passam: TODOS },
  { nome: 'EmpreendimentoController.getOne', metodo: 'GET', url: `/empreendimentos/${EMP}`, passam: TODOS },
  { nome: 'EmpreendimentoController.buscarBook', metodo: 'GET', url: `/empreendimentos/${EMP}/book`, passam: TODOS },
  { nome: 'EmpreendimentoController.baixarZipBook', metodo: 'GET', url: `/empreendimentos/${EMP}/book/zip`, passam: TODOS },
  { nome: 'EmpreendimentoController.create', metodo: 'POST', url: '/empreendimentos', body: {}, passam: ADMIN },
  { nome: 'EmpreendimentoController.publicar', metodo: 'PATCH', url: `/empreendimentos/${EMP}/publicar`, passam: ADMIN },
  { nome: 'EmpreendimentoController.despublicar', metodo: 'PATCH', url: `/empreendimentos/${EMP}/despublicar`, passam: ADMIN },
  { nome: 'EmpreendimentoController.analisarBook', metodo: 'POST', url: '/empreendimentos/book/analisar', body: {}, passam: ADMIN },
  {
    nome: 'EmpreendimentoController.confirmarBook',
    metodo: 'POST',
    url: '/empreendimentos/book/confirmar',
    body: { ficha: { itensLazer: [], tipologias: [] }, paginas: [] },
    passam: ADMIN,
  },
  { nome: 'EmpreendimentoController.publicarUnidadesNoSite', metodo: 'PATCH', url: `/empreendimentos/${EMP}/unidades/site`, body: { publicado: true }, passam: ADMIN },
  { nome: 'EmpreendimentoController.gerarLoteImoveis', metodo: 'POST', url: `/empreendimentos/${EMP}/imoveis/gerar-lote`, body: {}, passam: ADMIN },
  { nome: 'EmpreendimentoController.criarImoveisLote', metodo: 'POST', url: `/empreendimentos/${EMP}/imoveis/lote`, body: { imoveis: [] }, passam: ADMIN },
  { nome: 'EmpreendimentoController.listarProdutosPlanilha', metodo: 'POST', url: `/empreendimentos/${EMP}/imoveis/listar-produtos-planilha`, body: {}, passam: ADMIN },
  { nome: 'EmpreendimentoController.importarPlanilhaImoveis', metodo: 'POST', url: `/empreendimentos/${EMP}/imoveis/importar-planilha`, body: {}, passam: ADMIN },
  { nome: 'EmpreendimentoController.importarFichaTecnicaPdf', metodo: 'POST', url: `/empreendimentos/${EMP}/importar-pdf`, body: {}, passam: ADMIN },
  { nome: 'EmpreendimentoController.confirmarFichaTecnica', metodo: 'POST', url: `/empreendimentos/${EMP}/confirmar-ficha-tecnica`, body: { tipologias: [] }, passam: ADMIN },
  { nome: 'EmpreendimentoController.uploadPhoto', metodo: 'POST', url: `/empreendimentos/${EMP}/photos`, arquivo: true, passam: ADMIN },
  { nome: 'EmpreendimentoController.deletePhoto', metodo: 'DELETE', url: `/empreendimentos/${EMP}/photos/f-1`, passam: ADMIN },
  { nome: 'EmpreendimentoController.reorderPhotos', metodo: 'PATCH', url: `/empreendimentos/${EMP}/photos/reorder`, body: { photoIds: [] }, passam: ADMIN },
  { nome: 'EmpreendimentoController.update', metodo: 'PATCH', url: `/empreendimentos/${EMP}`, body: { construtoraId: CONS }, passam: ADMIN },
  // ConstrutoraController (Construtoras, Fatia A): corretor so le.
  { nome: 'ConstrutoraController.list', metodo: 'GET', url: '/construtoras', passam: TODOS },
  { nome: 'ConstrutoraController.getOne', metodo: 'GET', url: `/construtoras/${CONS}`, passam: TODOS },
  { nome: 'ConstrutoraController.create', metodo: 'POST', url: '/construtoras', body: { nome: 'Novolar' }, passam: ADMIN },
  { nome: 'ConstrutoraController.update', metodo: 'PATCH', url: `/construtoras/${CONS}`, body: { sobre: 'x' }, passam: ADMIN },
  { nome: 'ConstrutoraController.remove', metodo: 'DELETE', url: `/construtoras/${CONS}`, passam: ADMIN },
  { nome: 'ConstrutoraController.uploadLogo', metodo: 'POST', url: `/construtoras/${CONS}/logo`, arquivo: true, passam: ADMIN },
  { nome: 'ConstrutoraController.deleteLogo', metodo: 'DELETE', url: `/construtoras/${CONS}/logo`, passam: ADMIN },
];

// Rotas liberadas a DASHBOARD_ROLES no guard (o resto TEM de ser so admin).
const LIBERADAS_AO_DASHBOARD: Record<string, string[]> = {
  ImovelController: ['list', 'get', 'create', 'update', 'updateStatus', 'uploadPhoto', 'deletePhoto', 'reorderPhotos'],
  ContratoController: ['list', 'get', 'create', 'encerrar'],
  EmpreendimentoController: ['list', 'getOne', 'buscarBook', 'baixarZipBook'],
  ConstrutoraController: ['list', 'getOne'],
};
const CONTROLLERS = { ImovelController, ContratoController, EmpreendimentoController, ConstrutoraController };

// Mesma resolucao do RolesGuard (getAllAndOverride: metodo antes da classe).
function rotasDoController(controller: new (...args: never[]) => unknown) {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((nome) => nome !== 'constructor' && typeof proto[nome] === 'function')
    .filter((nome) => Reflect.getMetadata(PATH_METADATA, proto[nome] as object) !== undefined)
    .map((nome) => {
      const handler = proto[nome] as object;
      const roles =
        (Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined) ??
        (Reflect.getMetadata(ROLES_KEY, controller) as string[] | undefined);
      return {
        nome,
        metodo: RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number],
        path: Reflect.getMetadata(PATH_METADATA, handler) as string,
        roles,
      };
    });
}

describe('Permissoes area Imoveis - META-TESTE (metadata de roles)', () => {
  for (const [nomeController, controller] of Object.entries(CONTROLLERS)) {
    describe(nomeController, () => {
      const rotas = rotasDoController(controller);
      const liberadas = LIBERADAS_AO_DASHBOARD[nomeController];

      it('classe e so Administrador (rota nova nasce fechada)', () => {
        expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual(['Administrador']);
      });

      it.each(rotas.map((r) => [`${r.metodo} ${r.path} (${r.nome})`, r] as const))('%s', (_rotulo, rota) => {
        if (liberadas.includes(rota.nome)) {
          expect(rota.roles).toEqual(DASHBOARD_ROLES);
        } else {
          expect(rota.roles).toEqual(['Administrador']);
        }
      });

      it('lista de liberadas nao tem nome inexistente', () => {
        const nomes = rotas.map((r) => r.nome);
        for (const n of liberadas) expect(nomes).toContain(n);
      });

      it('toda rota do controller esta na tabela HTTP abaixo', () => {
        const cobertas = new Set(ROTAS.map((r) => r.nome.split(' ')[0]));
        for (const r of rotas) expect(cobertas).toContain(`${nomeController}.${r.nome}`);
      });
    });
  }
});

describe('Permissoes area Imoveis - tabela HTTP (RolesGuard real)', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100_000 }])],
      controllers: [ImovelController, EmpreendimentoController, ContratoController, ConstrutoraController],
      providers: [
        CreateImovelUseCase,
        UpdateImovelUseCase,
        AlterarStatusImovelUseCase,
        UploadImovelPhotoUseCase,
        DeleteImovelPhotoUseCase,
        ReorderImovelPhotosUseCase,
        CreateContratoUseCase,
        EncerrarContratoUseCase,
      ],
    })
      .useMocker((token) =>
        typeof token === 'string' && token in repositoriosFalsos
          ? repositoriosFalsos[token]
          : { execute: jest.fn(async () => RESPOSTA_MOCK) },
      )
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeAuthGuard)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function chamar(perfil: Perfil, rota: Rota): Promise<{ status: number; body: { message?: string } | null }> {
    const headers: Record<string, string> = { 'x-perfil': perfil };
    let body: BodyInit | undefined;
    if (rota.arquivo) {
      const fd = new FormData();
      fd.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'foto.jpg');
      fd.append('categoria', 'fachada');
      body = fd;
    } else if (rota.metodo !== 'GET') {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(rota.body ?? {});
    }
    const res = await fetch(`${base}${rota.url}`, { method: rota.metodo, headers, body });
    const texto = await res.text();
    let json: { message?: string } | null = null;
    try {
      json = JSON.parse(texto);
    } catch {
      json = null;
    }
    return { status: res.status, body: json };
  }

  const casos = ROTAS.flatMap((rota) =>
    TODOS.map((perfil) => [rota.nome, perfil, rota.passam.includes(perfil) ? 'passa' : '403', rota] as const),
  );

  it.each(casos)('%s - %s: %s', async (_nome, perfil, esperado, rota) => {
    const { status, body } = await chamar(perfil, rota);
    if (esperado === 'passa') {
      if (status >= 400) throw new Error(`esperava passar, veio ${status}: ${body?.message ?? ''}`);
    } else {
      expect(status).toBe(403);
    }
  });

  it('403 de status tem a mensagem amigavel decidida', async () => {
    const rota = ROTAS.find((r) => r.nome === 'ImovelController.updateStatus')!;
    const { status, body } = await chamar('corretor', rota);
    expect(status).toBe(403);
    expect(body?.message).toBe('Somente gerência ou administração altera o status da unidade.');
  });

  it('POST /imoveis de corretor: servidor forca disponivel/nao publicado e grava o dono', async () => {
    imovelRepository.create.mockClear();
    const rota = ROTAS.find((r) => r.nome === 'ImovelController.create')!;
    await chamar('corretor', { ...rota, body: { title: 'Casa', tipo: 'casa', finalidade: 'venda', status: 'vendido' } });
    expect(imovelRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'disponivel', publicado: false, criadoPorUserId: 'u-corretor' }),
    );
  });

  async function enviarFoto(perfil: Perfil, conteudo: Uint8Array<ArrayBuffer>, nome = 'foto.jpg') {
    const fd = new FormData();
    fd.append('file', new Blob([conteudo], { type: 'image/jpeg' }), nome);
    const res = await fetch(`${base}/imoveis/${IM_COR}/photos`, { method: 'POST', headers: { 'x-perfil': perfil }, body: fd });
    return { status: res.status, body: (await res.json().catch(() => null)) as { message?: string } | null };
  }

  it('foto que nao e JPG/PNG/WebP (HTML com nome .jpg): 400', async () => {
    const { status, body } = await enviarFoto('admin', new TextEncoder().encode('<html><script>alert(1)</script></html>'));
    expect(status).toBe(400);
    expect(body?.message).toBe('Envie uma foto JPG, PNG ou WebP.');
  });

  it('foto acima de 10 MB: 413 do multer (antes do use case)', async () => {
    const grande = new Uint8Array(10 * 1024 * 1024 + 1);
    grande.set(JPEG);
    const { status } = await enviarFoto('admin', grande);
    expect(status).toBe(413);
  });

  it('foto valida com nome "x.html": gravada como foto.jpg', async () => {
    const storage = repositoriosFalsos.IFileStorageService as { upload: jest.Mock };
    storage.upload.mockClear();
    const { status } = await enviarFoto('admin', JPEG, 'x.html');
    expect(status).toBe(201);
    expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ originalname: 'foto.jpg', mimetype: 'image/jpeg' }));
  });

  it('logo da construtora acima de 2 MB: 413 do multer (antes do use case)', async () => {
    const grande = new Uint8Array(2 * 1024 * 1024 + 1);
    grande.set(JPEG);
    const fd = new FormData();
    fd.append('file', new Blob([grande], { type: 'image/jpeg' }), 'logo.jpg');
    const res = await fetch(`${base}/construtoras/${CONS}/logo`, { method: 'POST', headers: { 'x-perfil': 'admin' }, body: fd });
    expect(res.status).toBe(413);
  });

  it('POST /imoveis de gerente com empreendimento: servidor forca avulso', async () => {
    imovelRepository.create.mockClear();
    const rota = ROTAS.find((r) => r.nome === 'ImovelController.create')!;
    await chamar('gerente', { ...rota, body: { title: 'Casa', tipo: 'casa', finalidade: 'venda', empreendimentoId: EMP, codigoInterno: 'AP-1' } });
    expect(imovelRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ empreendimentoId: null, tipoItem: 'unidade', codigoInterno: null }),
    );
  });

  it('PATCH de corretor dono trocando empreendimento: 403 com a mensagem decidida', async () => {
    const rota = ROTAS.find((r) => r.nome === 'ImovelController.update')!;
    const { status, body } = await chamar('corretor', { ...rota, body: { empreendimentoId: EMP } });
    expect(status).toBe(403);
    expect(body?.message).toBe('Somente a administração vincula imóveis a empreendimentos.');
  });
});
