import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ViviApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-vivi-api-key'];
    const expectedKey = this.config.get<string>('VIVI_API_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('VIVI_API_KEY não configurada no servidor');
    }

    if (!apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('API key inválida ou ausente');
    }

    return true;
  }
}
