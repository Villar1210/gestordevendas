// src/shared/infra/http/guards/jwt-auth.guard.ts
// Guard reutilizavel por qualquer modulo (Kanban, Atendimento, Pagamentos...).
// Basta usar @UseGuards(JwtAuthGuard) no controller para exigir login.
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
