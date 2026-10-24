// src/modules/bii/bii.module.ts
// BII (Business Intelligence Imobiliario).
// Fatia 1: historico de etapas (listener de 'card.stage.changed') + Painel de
// Vendas (GET /bii/painel).
// Fatia 2: Analise por Endereco (ITBI no raio, /bii/analises/*, tenant) e
// dados publicos do ITBI (/bii-plataforma/itbi/*, so Super Usuario).
// Fatia 3: Concorrentes (cadastro manual, /bii/concorrentes, tenant) - entram
// tambem na Analise por Endereco.
// Fatia 4: Viabilidade HIS/HMP/MCMV (/bii/viabilidade, so calculo).
// Fatia 5: Estudo de terreno (/bii/estudos, tenant) - snapshot de analise +
// viabilidade + posicionamento.
// Nao importa nenhum outro modulo de negocio. EventEmitterModule ja e global.
import { Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { BiiPainelController } from './infra/http/bii-painel.controller';
import { BiiAnaliseController } from './infra/http/bii-analise.controller';
import { BiiPlataformaController } from './infra/http/bii-plataforma.controller';
import { BiiConcorrenteController } from './infra/http/bii-concorrente.controller';
import { BiiViabilidadeController } from './infra/http/bii-viabilidade.controller';
import { BiiEstudoController } from './infra/http/bii-estudo.controller';
import {
  AtualizarEstudoUseCase,
  CriarEstudoUseCase,
  ExcluirEstudoUseCase,
  GetEstudoUseCase,
  ListEstudosUseCase,
} from './application/use-cases/estudos.use-cases';
import { PrismaEstudoRepository } from './infra/database/prisma-estudo.repository';
import { ESTUDO_REPOSITORY } from './domain/repositories/estudo-repository.interface';
import { CalcularViabilidadeUseCase, GetParametrosViabilidadeUseCase } from './application/use-cases/viabilidade.use-cases';
import {
  ConcorrenteGeocodificador,
  CreateConcorrenteUseCase,
  DeleteConcorrenteUseCase,
  GetConcorrenteUseCase,
  ListConcorrentesUseCase,
  UpdateConcorrenteUseCase,
} from './application/use-cases/concorrentes.use-cases';
import { PrismaConcorrenteRepository } from './infra/database/prisma-concorrente.repository';
import { CONCORRENTE_REPOSITORY } from './domain/repositories/concorrente-repository.interface';
import { GetPainelVendasUseCase } from './application/use-cases/get-painel-vendas.use-case';
import { AnalisarEnderecoUseCase } from './application/use-cases/analisar-endereco.use-case';
import { GetAnaliseUseCase, ListAnalisesUseCase } from './application/use-cases/analises-salvas.use-case';
import { GetItbiCoberturaUseCase } from './application/use-cases/itbi-cobertura.use-case';
import {
  GetGeocodificacaoItbiUseCase,
  ImportarItbiUseCase,
  IniciarGeocodificacaoItbiUseCase,
  IniciarGeoSampaUseCase,
  GetGeoSampaUseCase,
  ListImportacoesItbiUseCase,
  XLSX_INSPETOR,
} from './application/use-cases/itbi-plataforma.use-cases';
import { ImportadorItbiService } from './application/services/importador-itbi.service';
import { GeocodificacaoItbiService } from './application/services/geocodificacao-itbi.service';
import { GeoSampaService } from './application/services/geosampa.service';
import { GeoSampaWfsClient } from './infra/providers/geosampa-wfs.client';
import { PrismaGeoSampaRepository } from './infra/database/prisma-geosampa.repository';
import { GEOSAMPA_WFS } from './domain/ports/geosampa-wfs.interface';
import { GEOSAMPA_REPOSITORY } from './domain/repositories/geosampa-repository.interface';
import { CoberturaItbiCache } from './application/services/cobertura-itbi.cache';
import { CardStageChangedListener } from './infra/listeners/card-stage-changed.listener';
import { PrismaPainelVendasRepository } from './infra/database/prisma-painel-vendas.repository';
import { PrismaCardStageEventoRepository } from './infra/database/prisma-card-stage-evento.repository';
import { PrismaItbiRepository } from './infra/database/prisma-itbi.repository';
import { PrismaItbiImportacaoRepository } from './infra/database/prisma-itbi-importacao.repository';
import { PrismaGeocodeCacheRepository } from './infra/database/prisma-geocode-cache.repository';
import { PrismaBiiAnaliseRepository } from './infra/database/prisma-bii-analise.repository';
import { NominatimGeocodingProvider } from './infra/providers/nominatim-geocoding.provider';
import { GeocodingComCacheProvider } from './infra/providers/geocoding-com-cache.provider';
import { ExceljsItbiPlanilhaReader } from './infra/providers/itbi-planilha.reader';
import { XlsxInspetor } from './infra/providers/xlsx-inspetor';
import { GEOCODING_COM_CACHE, GEOCODING_PROVIDER } from './domain/ports/geocoding-provider.interface';
import { ITBI_PLANILHA_READER } from './domain/ports/itbi-planilha-reader.interface';
import { ITBI_REPOSITORY } from './domain/repositories/itbi-repository.interface';
import { ITBI_IMPORTACAO_REPOSITORY } from './domain/repositories/itbi-importacao-repository.interface';
import { GEOCODE_CACHE_REPOSITORY } from './domain/repositories/geocode-cache-repository.interface';
import { BII_ANALISE_REPOSITORY } from './domain/repositories/bii-analise-repository.interface';

@Module({
  controllers: [BiiPainelController, BiiAnaliseController, BiiPlataformaController, BiiConcorrenteController, BiiViabilidadeController, BiiEstudoController],
  providers: [
    PrismaService,
    // Fatia 1
    GetPainelVendasUseCase,
    CardStageChangedListener,
    { provide: 'IPainelVendasRepository', useClass: PrismaPainelVendasRepository },
    { provide: 'ICardStageEventoRepository', useClass: PrismaCardStageEventoRepository },
    // Fatia 2
    AnalisarEnderecoUseCase,
    ListAnalisesUseCase,
    GetAnaliseUseCase,
    GetItbiCoberturaUseCase,
    ImportarItbiUseCase,
    ListImportacoesItbiUseCase,
    IniciarGeocodificacaoItbiUseCase,
    IniciarGeoSampaUseCase,
    GetGeoSampaUseCase,
    GetGeocodificacaoItbiUseCase,
    ImportadorItbiService,
    GeocodificacaoItbiService,
    GeoSampaService,
    { provide: GEOSAMPA_WFS, useClass: GeoSampaWfsClient },
    { provide: GEOSAMPA_REPOSITORY, useClass: PrismaGeoSampaRepository },
    CoberturaItbiCache,
    NominatimGeocodingProvider,
    GeocodingComCacheProvider,
    { provide: GEOCODING_PROVIDER, useExisting: GeocodingComCacheProvider },
    { provide: GEOCODING_COM_CACHE, useExisting: GeocodingComCacheProvider },
    { provide: ITBI_PLANILHA_READER, useClass: ExceljsItbiPlanilhaReader },
    { provide: XLSX_INSPETOR, useClass: XlsxInspetor },
    { provide: ITBI_REPOSITORY, useClass: PrismaItbiRepository },
    { provide: ITBI_IMPORTACAO_REPOSITORY, useClass: PrismaItbiImportacaoRepository },
    { provide: GEOCODE_CACHE_REPOSITORY, useClass: PrismaGeocodeCacheRepository },
    { provide: BII_ANALISE_REPOSITORY, useClass: PrismaBiiAnaliseRepository },
    // Fatia 3
    ListConcorrentesUseCase,
    GetConcorrenteUseCase,
    CreateConcorrenteUseCase,
    UpdateConcorrenteUseCase,
    DeleteConcorrenteUseCase,
    ConcorrenteGeocodificador,
    { provide: CONCORRENTE_REPOSITORY, useClass: PrismaConcorrenteRepository },
    // Fatia 4
    GetParametrosViabilidadeUseCase,
    CalcularViabilidadeUseCase,
    // Fatia 5
    ListEstudosUseCase,
    GetEstudoUseCase,
    CriarEstudoUseCase,
    AtualizarEstudoUseCase,
    ExcluirEstudoUseCase,
    { provide: ESTUDO_REPOSITORY, useClass: PrismaEstudoRepository },
  ],
})
export class BiiModule {}
