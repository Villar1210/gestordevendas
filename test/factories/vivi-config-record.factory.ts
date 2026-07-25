// test/factories/vivi-config-record.factory.ts
import { ViviConfigRecord } from '../../src/modules/vivi_sdr/domain/repositories/vivi-config-repository.interface';

export function buildViviConfigRecord(overrides: Partial<ViviConfigRecord> = {}): ViviConfigRecord {
  return {
    id: 'vivi-config-1',
    tenantId: 'tenant-1',
    precoMinimo: 100000,
    limiteSemPerfil: 150000,
    limiteFaixa1: 264000,
    limiteFaixa2: 350000,
    limiteFaixa3: 500000,
    limiteFaixa4: 800000,
    faixa1SubsidioMax: null,
    faixa1JurosMin: null,
    faixa1JurosMax: null,
    faixa1TetoFinanciamento: null,
    faixa1ExemploParcela: null,
    faixa2SubsidioMax: null,
    faixa2JurosMin: null,
    faixa2JurosMax: null,
    faixa2TetoFinanciamento: null,
    faixa2ExemploParcela: null,
    faixa3SubsidioMax: null,
    faixa3JurosMin: null,
    faixa3JurosMax: null,
    faixa3TetoFinanciamento: null,
    faixa3ExemploParcela: null,
    faixa4SubsidioMax: null,
    faixa4JurosMin: null,
    faixa4JurosMax: null,
    faixa4TetoFinanciamento: null,
    faixa4ExemploParcela: null,
    updatedAt: new Date(),
    ...overrides,
  };
}
