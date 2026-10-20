// src/modules/bii/infra/database/prisma-geocode-cache.repository.ts
// GeocodeCache - GLOBAL. lat/lng nulos = "nao achou".
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  GeocodeCacheRegistro,
  IGeocodeCacheRepository,
} from '../../domain/repositories/geocode-cache-repository.interface';
import { PrecisaoGeocode } from '../../domain/ports/geocoding-provider.interface';

@Injectable()
export class PrismaGeocodeCacheRepository implements IGeocodeCacheRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(chave: string): Promise<GeocodeCacheRegistro | null> {
    const r = await this.prisma.geocodeCache.findUnique({ where: { chave } });
    if (!r) return null;
    return {
      chave: r.chave,
      provedor: r.provedor,
      lat: r.latitude,
      lng: r.longitude,
      precisao: r.precisao as PrecisaoGeocode | null,
      enderecoFormatado: r.enderecoFormatado,
      criadoEm: r.criadoEm,
    };
  }

  async gravar(reg: Omit<GeocodeCacheRegistro, 'criadoEm'>): Promise<void> {
    const dados = {
      provedor: reg.provedor,
      latitude: reg.lat,
      longitude: reg.lng,
      precisao: reg.precisao,
      enderecoFormatado: reg.enderecoFormatado?.slice(0, 500) ?? null,
      criadoEm: new Date(),
    };
    await this.prisma.geocodeCache.upsert({
      where: { chave: reg.chave },
      create: { chave: reg.chave, ...dados },
      update: dados,
    });
  }
}
