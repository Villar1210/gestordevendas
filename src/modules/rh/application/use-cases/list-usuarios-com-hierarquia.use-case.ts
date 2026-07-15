// src/modules/rh/application/use-cases/list-usuarios-com-hierarquia.use-case.ts
// Aba "Permissoes/Cargos" do Painel Administrativo - lista os usuarios
// aprovados cujo role participa da hierarquia (ver ROLES_COM_HIERARQUIA),
// com o cargo/superior atuais, para o Administrador reatribuir a qualquer
// momento (nao so na aprovacao original).
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { ICadastroRepository } from '../../domain/repositories/cadastro-repository.interface';
import { ROLES_COM_HIERARQUIA } from '../../domain/services/cargos-hierarquicos';

interface ListUsuariosComHierarquiaInput {
  tenantId: string;
  requesterRole: string;
}

export interface UsuarioComHierarquia {
  id: string;
  name: string;
  email: string;
  roleName: string;
  cargoHierarquico: string | null;
  superiorId: string | null;
  // Modulo Plantao/Stand - so preenchido quando cargoHierarquico e "coordenador".
  standId: string | null;
}

@Injectable()
export class ListUsuariosComHierarquiaUseCase {
  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
  ) {}

  async execute(input: ListUsuariosComHierarquiaInput): Promise<UsuarioComHierarquia[]> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode ver a gestao de cargos.');
    }

    const usuarios = await this.cadastroRepository.findAllAprovadosComContratoByTenant(
      input.tenantId,
      ROLES_COM_HIERARQUIA,
    );

    return usuarios.map((usuario) => ({
      id: usuario.id,
      name: usuario.name,
      email: usuario.email,
      roleName: usuario.roleName,
      cargoHierarquico: usuario.cargoHierarquico,
      superiorId: usuario.superiorId,
      standId: usuario.standId,
    }));
  }
}
