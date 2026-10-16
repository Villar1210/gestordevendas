// Regras de permissao da area Imoveis aplicadas DENTRO dos use cases (R1/R2),
// com repositorios em memoria (jest.fn) - sem banco, sem HTTP.
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateImovelUseCase } from './create-imovel.use-case';
import { UpdateImovelUseCase } from './update-imovel.use-case';
import { AlterarStatusImovelUseCase } from './alterar-status-imovel.use-case';
import { UploadImovelPhotoUseCase } from './upload-imovel-photo.use-case';
import { DeleteImovelPhotoUseCase } from './delete-imovel-photo.use-case';
import { ReorderImovelPhotosUseCase } from './reorder-imovel-photos.use-case';
import { CreateContratoUseCase } from './create-contrato.use-case';
import { EncerrarContratoUseCase } from './encerrar-contrato.use-case';
import { AtorImovel } from '../../domain/services/permissao-imovel';
import { EdicaoImovelBloqueadaError } from '../../domain/repositories/imovel-repository.interface';
import { UploadEmpreendimentoPhotoUseCase } from './upload-empreendimento-photo.use-case';

const TENANT = 't-1';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
const admin: AtorImovel = { userId: 'admin-1', role: 'Administrador', cargo: null };
const corretor: AtorImovel = { userId: 'cor-1', role: 'Corretor', cargo: 'corretor' };
const outroCorretor: AtorImovel = { userId: 'cor-2', role: 'Corretor', cargo: 'corretor' };
const semCargo: AtorImovel = { userId: 'cor-3', role: 'Corretor', cargo: null };
const parceiro: AtorImovel = { userId: 'par-1', role: 'Corretor Parceiro', cargo: null };
const gerente: AtorImovel = { userId: 'ger-1', role: 'Corretor', cargo: 'gerente' };
const coordenador: AtorImovel = { userId: 'coo-1', role: 'Corretor', cargo: 'coordenador' };

function imovel(over: Partial<{ criadoPorUserId: string | null; publicado: boolean; status: string }> = {}) {
  return { id: 'im-1', tenantId: TENANT, criadoPorUserId: 'cor-1', publicado: false, status: 'disponivel', ...over };
}

function repos(atual = imovel()) {
  const imovelRepository = {
    create: jest.fn(async (d: Record<string, unknown>) => ({ id: 'novo', ...d })),
    update: jest.fn(async (id: string, d: Record<string, unknown>) => ({ ...atual, ...d, id })),
    findByIdAndTenant: jest.fn(async () => atual),
    findPhotosByImovel: jest.fn(async () => [{ id: 'f-1' }, { id: 'f-2' }]),
    addPhoto: jest.fn(async (d: Record<string, unknown>) => ({ id: 'f-novo', ...d })),
    findPhotoByIdAndTenant: jest.fn(async () => ({ id: 'f-1', imovelId: 'im-1', tenantId: TENANT })),
    deletePhoto: jest.fn(async () => undefined),
    reorderPhotos: jest.fn(async () => []),
  };
  const empreendimentoRepository = { findByIdAndTenant: jest.fn(async () => ({ id: 'emp-1' })) };
  const fileStorage = { upload: jest.fn(async () => ({ url: '/uploads/x.jpg' })) };
  return { imovelRepository, empreendimentoRepository, fileStorage };
}

describe('CreateImovelUseCase (R2)', () => {
  const base = { tenantId: TENANT, title: 'Casa', tipo: 'casa', finalidade: 'venda' };

  it.each([corretor, parceiro, gerente])('nao-admin (%o): forca status disponivel e publicado false, grava dono', async (ator) => {
    const r = repos();
    const uc = new CreateImovelUseCase(r.empreendimentoRepository as never, r.imovelRepository as never);
    await uc.execute({ ...base, status: 'vendido', publicado: true, ator });
    expect(r.imovelRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'disponivel', publicado: false, criadoPorUserId: ator.userId }),
    );
    expect(r.imovelRepository.create.mock.calls[0][0]).not.toHaveProperty('ator');
  });

  it('admin: mantem o status informado e grava dono', async () => {
    const r = repos();
    const uc = new CreateImovelUseCase(r.empreendimentoRepository as never, r.imovelRepository as never);
    await uc.execute({ ...base, status: 'reservado', ator: admin });
    expect(r.imovelRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reservado', criadoPorUserId: 'admin-1' }),
    );
  });
});

describe('UpdateImovelUseCase (R2)', () => {
  function uc(atual = imovel()) {
    const r = repos(atual);
    return { r, useCase: new UpdateImovelUseCase(r.empreendimentoRepository as never, r.imovelRepository as never) };
  }
  const entrada = (ator: AtorImovel, extra: Record<string, unknown> = {}) => ({
    imovelId: 'im-1',
    tenantId: TENANT,
    title: 'Novo titulo',
    ator,
    ...extra,
  });

  it('dono com imovel nao publicado: edita', async () => {
    const { r, useCase } = uc();
    await useCase.execute(entrada(corretor));
    expect(r.imovelRepository.update).toHaveBeenCalledWith('im-1', { title: 'Novo titulo' }, { tenantId: TENANT, userId: 'cor-1' });
  });

  it('dono com imovel publicado: 403', async () => {
    const { r, useCase } = uc(imovel({ publicado: true }));
    await expect(useCase.execute(entrada(corretor))).rejects.toThrow(ForbiddenException);
    await expect(useCase.execute(entrada(corretor))).rejects.toThrow('já foi publicado');
    expect(r.imovelRepository.update).not.toHaveBeenCalled();
  });

  it('outro corretor: 403', async () => {
    const { r, useCase } = uc();
    await expect(useCase.execute(entrada(outroCorretor))).rejects.toThrow('você mesmo cadastrou');
    expect(r.imovelRepository.update).not.toHaveBeenCalled();
  });

  it('gerente que nao e dono tambem nao edita cadastro (so status pela rota propria)', async () => {
    const { useCase } = uc();
    await expect(useCase.execute(entrada(gerente))).rejects.toThrow(ForbiddenException);
  });

  it('imovel sem dono (antigo): so admin', async () => {
    const { useCase } = uc(imovel({ criadoPorUserId: null }));
    await expect(useCase.execute(entrada(corretor))).rejects.toThrow(ForbiddenException);
  });

  it('admin edita tudo, inclusive publicado/status e imovel publicado de outro', async () => {
    const { r, useCase } = uc(imovel({ publicado: true, criadoPorUserId: 'cor-2' }));
    await useCase.execute(entrada(admin, { status: 'vendido', publicado: false }));
    expect(r.imovelRepository.update).toHaveBeenCalledWith(
      'im-1',
      { title: 'Novo titulo', status: 'vendido', publicado: false },
      undefined,
    );
  });

  it('nao-admin nao muda status no PATCH (403) e nem publicado (403)', async () => {
    const { r, useCase } = uc();
    await expect(useCase.execute(entrada(corretor, { status: 'vendido' }))).rejects.toThrow('seletor de status');
    await expect(useCase.execute(entrada(corretor, { publicado: true }))).rejects.toThrow('Somente a administração');
    expect(r.imovelRepository.update).not.toHaveBeenCalled();
  });

  it('nao-admin reenviando o MESMO status/publicado: aceito e removido do update', async () => {
    const { r, useCase } = uc();
    await useCase.execute(entrada(corretor, { status: 'disponivel', publicado: false }));
    expect(r.imovelRepository.update).toHaveBeenCalledWith('im-1', { title: 'Novo titulo' }, { tenantId: TENANT, userId: 'cor-1' });
  });
});

describe('AlterarStatusImovelUseCase (R1)', () => {
  it.each([admin, gerente, coordenador])('pode: %o', async (ator) => {
    const r = repos();
    await new AlterarStatusImovelUseCase(r.imovelRepository as never).execute({
      imovelId: 'im-1',
      tenantId: TENANT,
      status: 'reservado',
      ator,
    });
    expect(r.imovelRepository.update).toHaveBeenCalledWith('im-1', { status: 'reservado' });
  });

  it.each([corretor, semCargo, parceiro])('nao pode (403 antes de ler o banco): %o', async (ator) => {
    const r = repos();
    await expect(
      new AlterarStatusImovelUseCase(r.imovelRepository as never).execute({
        imovelId: 'im-1',
        tenantId: TENANT,
        status: 'reservado',
        ator,
      }),
    ).rejects.toThrow('Somente gerência ou administração altera o status da unidade.');
    expect(r.imovelRepository.findByIdAndTenant).not.toHaveBeenCalled();
    expect(r.imovelRepository.update).not.toHaveBeenCalled();
  });
});

describe('Fotos do imovel (R2)', () => {
  const file = { buffer: JPEG, originalname: 'a.jpg', mimetype: 'image/jpeg' };

  it('upload: dono nao publicado ok; publicado / outro: 403 sem gravar arquivo', async () => {
    let r = repos();
    await new UploadImovelPhotoUseCase(r.imovelRepository as never, r.fileStorage as never).execute({
      imovelId: 'im-1', tenantId: TENANT, file, ator: corretor,
    });
    expect(r.fileStorage.upload).toHaveBeenCalled();

    for (const [atual, ator] of [
      [imovel({ publicado: true }), corretor],
      [imovel(), outroCorretor],
    ] as const) {
      r = repos(atual);
      await expect(
        new UploadImovelPhotoUseCase(r.imovelRepository as never, r.fileStorage as never).execute({
          imovelId: 'im-1', tenantId: TENANT, file, ator,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(r.fileStorage.upload).not.toHaveBeenCalled();
    }
  });

  it('delete: confere a foto do imovel da URL e o dono', async () => {
    let r = repos();
    await new DeleteImovelPhotoUseCase(r.imovelRepository as never).execute({
      imovelId: 'im-1', photoId: 'f-1', tenantId: TENANT, ator: corretor,
    });
    expect(r.imovelRepository.deletePhoto).toHaveBeenCalledWith('f-1', { tenantId: TENANT, userId: 'cor-1', imovelId: 'im-1' });

    r = repos();
    await expect(
      new DeleteImovelPhotoUseCase(r.imovelRepository as never).execute({
        imovelId: 'outro-imovel', photoId: 'f-1', tenantId: TENANT, ator: admin,
      }),
    ).rejects.toThrow(NotFoundException);

    r = repos();
    await expect(
      new DeleteImovelPhotoUseCase(r.imovelRepository as never).execute({
        imovelId: 'im-1', photoId: 'f-1', tenantId: TENANT, ator: outroCorretor,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(r.imovelRepository.deletePhoto).not.toHaveBeenCalled();
  });

  it('reorder: publicado bloqueia nao-admin, admin passa', async () => {
    let r = repos(imovel({ publicado: true }));
    await expect(
      new ReorderImovelPhotosUseCase(r.imovelRepository as never).execute({
        imovelId: 'im-1', tenantId: TENANT, photoIds: ['f-2', 'f-1'], ator: corretor,
      }),
    ).rejects.toThrow(ForbiddenException);
    r = repos(imovel({ publicado: true }));
    await new ReorderImovelPhotosUseCase(r.imovelRepository as never).execute({
      imovelId: 'im-1', tenantId: TENANT, photoIds: ['f-2', 'f-1'], ator: admin,
    });
    expect(r.imovelRepository.reorderPhotos).toHaveBeenCalled();
  });
});

describe('Contratos (R1 - mudam o status da unidade)', () => {
  function contratoRepos() {
    const r = repos();
    const proprietarioRepository = { findByIdAndTenant: jest.fn(async () => ({ id: 'p-1' })), create: jest.fn() };
    const inquilinoRepository = { findByIdAndTenant: jest.fn(async () => ({ id: 'i-1' })), create: jest.fn() };
    const contratoRepository = {
      create: jest.fn(async (d: Record<string, unknown>) => ({ id: 'c-1', ...d })),
      findByIdAndTenant: jest.fn(async () => ({ id: 'c-1', imovelId: 'im-1', tipo: 'venda', status: 'ativo' })),
      updateStatus: jest.fn(async () => ({ id: 'c-1', status: 'encerrado' })),
    };
    return { ...r, proprietarioRepository, inquilinoRepository, contratoRepository };
  }
  const dados = {
    tenantId: TENANT, imovelId: 'im-1', proprietarioId: 'p-1', inquilinoCompradorId: 'i-1',
    tipo: 'venda', valor: 100, dataInicio: new Date('2026-10-16T00:00:00Z'),
  };

  it.each([admin, gerente, coordenador])('criar e encerrar: pode (%o)', async (ator) => {
    const r = contratoRepos();
    await new CreateContratoUseCase(
      r.imovelRepository as never, r.proprietarioRepository as never, r.inquilinoRepository as never, r.contratoRepository as never,
    ).execute({ ...dados, ator });
    expect(r.imovelRepository.update).toHaveBeenCalledWith('im-1', { status: 'vendido' });
    await new EncerrarContratoUseCase(r.contratoRepository as never, r.imovelRepository as never).execute({
      contratoId: 'c-1', tenantId: TENANT, ator,
    });
    expect(r.contratoRepository.updateStatus).toHaveBeenCalled();
  });

  it.each([corretor, semCargo, parceiro])('criar e encerrar: 403 sem tocar em nada (%o)', async (ator) => {
    const r = contratoRepos();
    await expect(
      new CreateContratoUseCase(
        r.imovelRepository as never, r.proprietarioRepository as never, r.inquilinoRepository as never, r.contratoRepository as never,
      ).execute({ ...dados, proprietarioId: undefined, proprietario: { nome: 'X', telefone: '1' }, ator }),
    ).rejects.toThrow('Somente gerência ou administração');
    expect(r.proprietarioRepository.create).not.toHaveBeenCalled();
    expect(r.contratoRepository.create).not.toHaveBeenCalled();
    await expect(
      new EncerrarContratoUseCase(r.contratoRepository as never, r.imovelRepository as never).execute({
        contratoId: 'c-1', tenantId: TENANT, ator,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(r.contratoRepository.updateStatus).not.toHaveBeenCalled();
    expect(r.imovelRepository.update).not.toHaveBeenCalled();
  });
});

describe('Revisao de seguranca - vinculo com empreendimento (MEDIO-2)', () => {
  const base = { tenantId: TENANT, title: 'Casa', tipo: 'casa', finalidade: 'venda' };

  it('POST de nao-admin: forca avulso (empreendimentoId null, tipoItem unidade, sem codigoInterno)', async () => {
    const r = repos();
    const uc = new CreateImovelUseCase(r.empreendimentoRepository as never, r.imovelRepository as never);
    await uc.execute({ ...base, empreendimentoId: 'emp-1', tipoItem: 'vaga_avulsa', codigoInterno: 'AP-101', ator: gerente });
    expect(r.imovelRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ empreendimentoId: null, tipoItem: 'unidade', codigoInterno: null }),
    );
    expect(r.empreendimentoRepository.findByIdAndTenant).not.toHaveBeenCalled();
  });

  it('POST de admin: mantem o vinculo com o empreendimento', async () => {
    const r = repos();
    const uc = new CreateImovelUseCase(r.empreendimentoRepository as never, r.imovelRepository as never);
    await uc.execute({ ...base, empreendimentoId: 'emp-1', codigoInterno: 'AP-101', ator: admin });
    expect(r.imovelRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ empreendimentoId: 'emp-1', codigoInterno: 'AP-101' }),
    );
  });

  it.each([
    { empreendimentoId: 'emp-1' },
    { tipoItem: 'vaga_avulsa' },
    { codigoInterno: 'AP-101' },
  ])('PATCH de nao-admin mudando %o: 403 "Somente a administração vincula..."', async (mudanca) => {
    const r = repos({ ...imovel(), empreendimentoId: null, tipoItem: 'unidade', codigoInterno: null } as never);
    const uc = new UpdateImovelUseCase(r.empreendimentoRepository as never, r.imovelRepository as never);
    await expect(uc.execute({ imovelId: 'im-1', tenantId: TENANT, ator: corretor, ...mudanca })).rejects.toThrow(
      'Somente a administração vincula imóveis a empreendimentos.',
    );
    expect(r.imovelRepository.update).not.toHaveBeenCalled();
  });

  it('PATCH de nao-admin reenviando os mesmos valores de vinculo: aceito e removido', async () => {
    const r = repos({ ...imovel(), empreendimentoId: null, tipoItem: 'unidade', codigoInterno: null } as never);
    const uc = new UpdateImovelUseCase(r.empreendimentoRepository as never, r.imovelRepository as never);
    await uc.execute({ imovelId: 'im-1', tenantId: TENANT, ator: corretor, empreendimentoId: null, title: 't' });
    expect(r.imovelRepository.update).toHaveBeenCalledWith('im-1', { title: 't' }, { tenantId: TENANT, userId: 'cor-1' });
  });
});

describe('Revisao de seguranca - escrita condicional (BAIXO-1)', () => {
  it('PATCH: repositorio recusou (publicaram no meio) -> 403 com a mesma mensagem', async () => {
    const r = repos();
    r.imovelRepository.findByIdAndTenant
      .mockResolvedValueOnce(imovel())
      .mockResolvedValueOnce(imovel({ publicado: true }));
    r.imovelRepository.update.mockRejectedValueOnce(new EdicaoImovelBloqueadaError());
    const uc = new UpdateImovelUseCase(r.empreendimentoRepository as never, r.imovelRepository as never);
    await expect(uc.execute({ imovelId: 'im-1', tenantId: TENANT, title: 'x', ator: corretor })).rejects.toThrow(
      'Este imóvel já foi publicado. Somente a administração pode editá-lo.',
    );
  });

  it('fotos: nao-admin passa a condicao de dono ao repositorio; admin nao', async () => {
    const file = { buffer: JPEG, originalname: 'a.jpg', mimetype: 'image/jpeg' };
    let r = repos();
    await new UploadImovelPhotoUseCase(r.imovelRepository as never, r.fileStorage as never).execute({
      imovelId: 'im-1', tenantId: TENANT, file, ator: corretor,
    });
    expect(r.imovelRepository.addPhoto).toHaveBeenCalledWith(expect.anything(), { tenantId: TENANT, userId: 'cor-1' });

    r = repos();
    await new ReorderImovelPhotosUseCase(r.imovelRepository as never).execute({
      imovelId: 'im-1', tenantId: TENANT, photoIds: ['f-2', 'f-1'], ator: corretor,
    });
    expect(r.imovelRepository.reorderPhotos).toHaveBeenCalledWith('im-1', expect.any(Array), { tenantId: TENANT, userId: 'cor-1' });

    r = repos();
    await new ReorderImovelPhotosUseCase(r.imovelRepository as never).execute({
      imovelId: 'im-1', tenantId: TENANT, photoIds: ['f-2', 'f-1'], ator: admin,
    });
    expect(r.imovelRepository.reorderPhotos).toHaveBeenCalledWith('im-1', expect.any(Array), undefined);
  });

  it.each(['upload', 'delete', 'reorder'] as const)('foto %s: corrida no repositorio -> 403', async (acao) => {
    const r = repos();
    r.imovelRepository.findByIdAndTenant
      .mockResolvedValueOnce(imovel())
      .mockResolvedValueOnce(imovel({ publicado: true }));
    const erro = new EdicaoImovelBloqueadaError();
    r.imovelRepository.addPhoto.mockRejectedValueOnce(erro);
    r.imovelRepository.deletePhoto.mockRejectedValueOnce(erro);
    r.imovelRepository.reorderPhotos.mockRejectedValueOnce(erro);
    const exec =
      acao === 'upload'
        ? new UploadImovelPhotoUseCase(r.imovelRepository as never, r.fileStorage as never).execute({
            imovelId: 'im-1', tenantId: TENANT, file: { buffer: JPEG, originalname: 'a.jpg', mimetype: 'image/jpeg' }, ator: corretor,
          })
        : acao === 'delete'
          ? new DeleteImovelPhotoUseCase(r.imovelRepository as never).execute({
              imovelId: 'im-1', photoId: 'f-1', tenantId: TENANT, ator: corretor,
            })
          : new ReorderImovelPhotosUseCase(r.imovelRepository as never).execute({
              imovelId: 'im-1', tenantId: TENANT, photoIds: ['f-2', 'f-1'], ator: corretor,
            });
    await expect(exec).rejects.toThrow(ForbiddenException);
  });
});

describe('Revisao de seguranca - upload de foto (BAIXO-2)', () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
  const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

  it.each([
    [JPEG, 'foto.jpg', 'image/jpeg'],
    [PNG, 'foto.png', 'image/png'],
    [WEBP, 'foto.webp', 'image/webp'],
  ])('imovel: grava com o nome/tipo REAL, ignorando originalname/mimetype enviados', async (buffer, nome, tipo) => {
    const r = repos();
    await new UploadImovelPhotoUseCase(r.imovelRepository as never, r.fileStorage as never).execute({
      imovelId: 'im-1', tenantId: TENANT, file: { buffer, originalname: 'pagina.html', mimetype: 'text/html' }, ator: admin,
    });
    expect(r.fileStorage.upload).toHaveBeenCalledWith({ buffer, originalname: nome, mimetype: tipo });
  });

  it.each([
    ['html', Buffer.from('<html><script>alert(1)</script></html>')],
    ['gif', Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00')],
    ['vazio', Buffer.alloc(0)],
  ])('imovel: %s -> 400 sem gravar', async (_nome, buffer) => {
    const r = repos();
    await expect(
      new UploadImovelPhotoUseCase(r.imovelRepository as never, r.fileStorage as never).execute({
        imovelId: 'im-1', tenantId: TENANT, file: { buffer, originalname: 'a.jpg', mimetype: 'image/jpeg' }, ator: admin,
      }),
    ).rejects.toThrow('Envie uma foto JPG, PNG ou WebP.');
    expect(r.fileStorage.upload).not.toHaveBeenCalled();
  });

  it('imovel: sem arquivo -> 400', async () => {
    const r = repos();
    await expect(
      new UploadImovelPhotoUseCase(r.imovelRepository as never, r.fileStorage as never).execute({
        imovelId: 'im-1', tenantId: TENANT, file: undefined as never, ator: admin,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('empreendimento: mesma validacao e nome real', async () => {
    const empreendimentoRepository = {
      findByIdAndTenant: jest.fn(async () => ({ id: 'emp-1' })),
      findPhotosByEmpreendimentoAndCategoria: jest.fn(async () => []),
      addPhoto: jest.fn(async (d: Record<string, unknown>) => d),
    };
    const fileStorage = { upload: jest.fn(async () => ({ url: '/uploads/imoveis/x.png' })) };
    const uc = new UploadEmpreendimentoPhotoUseCase(empreendimentoRepository as never, fileStorage as never);
    await uc.execute({ empreendimentoId: 'emp-1', tenantId: TENANT, categoria: 'fachada', file: { buffer: PNG, originalname: 'x.svg', mimetype: 'image/svg+xml' } });
    expect(fileStorage.upload).toHaveBeenCalledWith({ buffer: PNG, originalname: 'foto.png', mimetype: 'image/png' });
    await expect(
      uc.execute({ empreendimentoId: 'emp-1', tenantId: TENANT, categoria: 'fachada', file: { buffer: Buffer.from('<svg onload=alert(1)></svg>'), originalname: 'x.png', mimetype: 'image/png' } }),
    ).rejects.toThrow('Envie uma foto JPG, PNG ou WebP.');
    expect(fileStorage.upload).toHaveBeenCalledTimes(1);
  });
});
