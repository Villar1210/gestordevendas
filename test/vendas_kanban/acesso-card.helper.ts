// test/vendas_kanban/acesso-card.helper.ts
// So para testes: AcessoCardService com dependencias vazias. Os specs que nao
// passam `requisitante` (chamada de sistema) nunca chegam a consulta-las.
import { AcessoCardService } from '../../src/modules/vendas_kanban/application/services/acesso-card.service';
import { GetSubordinadosRecursivosUseCase } from '../../src/modules/auth/application/use-cases/get-subordinados-recursivos.use-case';
import { GetCorretoresEscaladosHojeUseCase } from '../../src/modules/plantao/application/use-cases/get-corretores-escalados-hoje.use-case';

export function acessoCardSemChecagem(
  subordinados: string[] = [],
  escaladosHoje: string[] = [],
): AcessoCardService {
  return new AcessoCardService(
    { execute: async () => subordinados } as unknown as GetSubordinadosRecursivosUseCase,
    { execute: async () => escaladosHoje } as unknown as GetCorretoresEscaladosHojeUseCase,
  );
}
