// src/modules/auth/application/templates/redefinicao-senha.email.ts
// E-mail de redefinicao de senha com a identidade do Gestor de Vendas.
// HTML em tabelas + estilos inline: e o que Gmail/Outlook renderizam bem.

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function montarEmailRedefinicaoSenha(input: {
  nome: string;
  link: string;
  urlPlataforma: string;
  validadeMinutos: number;
}): { subject: string; body: string } {
  const nome = escaparHtml(input.nome.trim().split(/\s+/)[0] || 'tudo bem');
  const link = escaparHtml(input.link);
  const logo = escaparHtml(`${input.urlPlataforma}/logo.png`);

  const body = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;">
        <tr><td style="padding:28px 32px 8px;" align="center">
          <img src="${logo}" alt="Gestor de Vendas" width="160" style="display:block;border:0;max-width:160px;height:auto;">
        </td></tr>
        <tr><td style="padding:16px 32px 0;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#142f4b;">Redefinição de senha</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Olá, ${nome}.</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Recebemos um pedido para redefinir a senha da sua conta no Gestor de Vendas. Clique no botão abaixo para criar uma nova senha.</p>
        </td></tr>
        <tr><td align="center" style="padding:0 32px 20px;">
          <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:10px;">Criar nova senha</a>
        </td></tr>
        <tr><td style="padding:0 32px 8px;">
          <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#475569;">O link vale por <strong>${input.validadeMinutos} minutos</strong> e só pode ser usado uma vez. Ao trocar a senha, você será desconectado dos outros aparelhos.</p>
          <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#475569;">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${link}" style="color:#1d4ed8;word-break:break-all;">${link}</a></p>
        </td></tr>
        <tr><td style="padding:12px 32px 28px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">Não pediu isso? Ignore este e-mail: sua senha continua a mesma. Nunca compartilhe este link com ninguém.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: 'Redefinição de senha – Gestor de Vendas', body };
}
