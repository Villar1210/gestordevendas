// src/modules/auth/application/services/login-attempts.service.ts
// Conta tentativas erradas POR CONTA (e-mail) e POR CODIGO de 2FA, em
// memoria. Substitui o antigo limite de 5 tentativas por IP no login, que
// bloqueava todo mundo de um plantao/loja que usa o mesmo Wi-Fi quando uma
// unica pessoa errava a senha. O limite por IP continua existindo, mais
// folgado (ver AuthController.login), para frear ataques em massa.
// Em memoria de proposito: o backend roda em 1 instancia; um restart zera
// os contadores, o que e aceitavel para este tipo de protecao.
import { Injectable } from '@nestjs/common';

interface Registro {
  falhas: number;
  bloqueadoAte: number | null;
  expiraEm: number;
}

@Injectable()
export class LoginAttemptsService {
  static readonly MAX_FALHAS_LOGIN = 5;
  static readonly BLOQUEIO_LOGIN_MS = 15 * 60 * 1000;
  static readonly MAX_FALHAS_CODIGO = 5;

  private readonly registros = new Map<string, Registro>();

  private chaveLogin(email: string): string {
    return `login:${email.trim().toLowerCase()}`;
  }

  private chaveCodigo(challengeId: string): string {
    return `2fa:${challengeId}`;
  }

  private obter(chave: string, agora: number): Registro | undefined {
    const r = this.registros.get(chave);
    if (r && r.expiraEm <= agora) {
      this.registros.delete(chave);
      return undefined;
    }
    return r;
  }

  // Minutos restantes de bloqueio para este e-mail (0 = liberado).
  minutosBloqueado(email: string, agora = Date.now()): number {
    const r = this.obter(this.chaveLogin(email), agora);
    if (!r?.bloqueadoAte || r.bloqueadoAte <= agora) return 0;
    return Math.ceil((r.bloqueadoAte - agora) / 60_000);
  }

  registrarFalhaLogin(email: string, agora = Date.now()): void {
    const chave = this.chaveLogin(email);
    const janela = LoginAttemptsService.BLOQUEIO_LOGIN_MS;
    const r = this.obter(chave, agora) ?? { falhas: 0, bloqueadoAte: null, expiraEm: agora + janela };
    r.falhas += 1;
    r.expiraEm = agora + janela;
    if (r.falhas >= LoginAttemptsService.MAX_FALHAS_LOGIN) {
      r.bloqueadoAte = agora + janela;
    }
    this.registros.set(chave, r);
  }

  limparLogin(email: string): void {
    this.registros.delete(this.chaveLogin(email));
  }

  // Retorna true quando o codigo atingiu o limite e deve ser invalidado.
  registrarFalhaCodigo(challengeId: string, agora = Date.now()): boolean {
    const chave = this.chaveCodigo(challengeId);
    const r = this.obter(chave, agora) ?? { falhas: 0, bloqueadoAte: null, expiraEm: agora + 10 * 60_000 };
    r.falhas += 1;
    this.registros.set(chave, r);
    return r.falhas >= LoginAttemptsService.MAX_FALHAS_CODIGO;
  }

  limparCodigo(challengeId: string): void {
    this.registros.delete(this.chaveCodigo(challengeId));
  }
}
