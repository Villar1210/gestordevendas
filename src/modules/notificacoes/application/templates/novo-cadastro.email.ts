// src/modules/notificacoes/application/templates/novo-cadastro.email.ts
// E-mail ao Administrador quando chega um cadastro publico pendente.
// So leva nome, perfil e o link - nenhum dado pessoal (CPF, telefone,
// endereco) sai por e-mail; o resto o Administrador ve dentro da
// plataforma, ja logado. HTML em tabelas + estilos inline (mesmo padrao
// de auth/application/templates/redefinicao-senha.email.ts).

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PERFIL_LEGIVEL: Record<string, string> = {
  Cliente: 'Cliente',
  Corretor: 'Corretor (equipe própria)',
  'Corretor Parceiro': 'Corretor Parceiro',
  'Imobiliaria Parceira': 'Imobiliária Parceira',
};

export function montarEmailNovoCadastro(input: {
  nomeAdministrador: string;
  nomeCadastro: string;
  roleName: string;
  link: string;
  urlPlataforma: string;
}): { subject: string; body: string } {
  const admin = escaparHtml(input.nomeAdministrador.trim().split(/\s+/)[0] || 'tudo bem');
  const nome = escaparHtml(input.nomeCadastro.trim());
  const perfil = escaparHtml(PERFIL_LEGIVEL[input.roleName] ?? input.roleName);
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
          <h1 style="margin:0 0 12px;font-size:20px;color:#142f4b;">Novo cadastro para analisar</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Olá, ${admin}.</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Chegou um novo cadastro pelo site e ele está aguardando a sua análise:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:15px;">
            <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Nome</td><td style="padding:2px 0;font-weight:bold;">${nome}</td></tr>
            <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Perfil</td><td style="padding:2px 0;font-weight:bold;">${perfil}</td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:0 32px 20px;">
          <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:10px;">Analisar cadastro</a>
        </td></tr>
        <tr><td style="padding:12px 32px 28px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">Os dados completos do cadastro ficam só dentro da plataforma, em RH → Aprovações. Você recebe este aviso por ser Administrador.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: `Novo cadastro para analisar: ${input.nomeCadastro.replace(/\s+/g, ' ').trim().slice(0, 80)}`, body };
}
