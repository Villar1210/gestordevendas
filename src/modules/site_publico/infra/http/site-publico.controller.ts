// src/modules/site_publico/infra/http/site-publico.controller.ts
// Controller PUBLICO (sem JwtAuthGuard) da vitrine imobiliaria. So expoe
// itens marcados como publicados; o formulario de lead tem limite proprio
// de envios por IP.
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SitePublicoService } from '../../application/site-publico.service';
import { ListarImoveisPublicosDto } from './dtos/listar-imoveis-publicos.dto';
import { RegistrarLeadSiteDto } from './dtos/registrar-lead-site.dto';

@Controller('public/site')
export class SitePublicoController {
  constructor(private readonly service: SitePublicoService) {}

  // GET /public/site/resolver?host=imoveis.exemplo.com.br -> { slug, nome }
  // Usado pelo frontend quando o site abre num dominio proprio da empresa.
  @Get('resolver')
  resolver(@Query('host') host = '') {
    return this.service.resolverPorDominio(String(host).slice(0, 255));
  }

  @Get(':slug')
  info(@Param('slug') slug: string) {
    return this.service.info(slug);
  }

  @Get(':slug/imoveis')
  listarImoveis(@Param('slug') slug: string, @Query() query: ListarImoveisPublicosDto) {
    return this.service.listarImoveis(slug, query);
  }

  @Get(':slug/imoveis/:id')
  obterImovel(@Param('slug') slug: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obterImovel(slug, id);
  }

  @Get(':slug/empreendimentos')
  listarEmpreendimentos(@Param('slug') slug: string) {
    return this.service.listarEmpreendimentos(slug);
  }

  @Get(':slug/empreendimentos/:id')
  obterEmpreendimento(@Param('slug') slug: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.obterEmpreendimento(slug, id);
  }

  // Maximo de 5 envios a cada 10 minutos por IP.
  @Post(':slug/leads')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  registrarLead(@Param('slug') slug: string, @Body() dto: RegistrarLeadSiteDto) {
    return this.service.registrarLead(slug, dto);
  }
}
