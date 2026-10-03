// src/modules/vivi-integration/services/aviso-agendamento.ts
// Funcoes puras (sem Nest/Prisma) usadas pelo POST /vivi/agendar-visita para
// avisar o corretor dono do card por WhatsApp (via Chatwoot). Extraidas do
// controller para poderem ser testadas isoladamente (ver
// aviso-agendamento.spec.ts).

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

// Telefone do cadastro do corretor (User.whatsapp/telefone) e texto livre
// ("(11) 99999-8888", "+55 11 ..."). O Chatwoot espera DDI+DDD+numero.
// Retorna nulo quando nao da para montar um numero brasileiro valido.
export function normalizarTelefoneBR(valor: string | null | undefined): string | null {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (/^55\d{10,11}$/.test(digitos)) return digitos;
  if (/^\d{10,11}$/.test(digitos)) return `55${digitos}`;
  return null;
}

// dataVisita chega como "YYYY-MM-DD" (data pura, sem fuso). NAO usar
// new Date("YYYY-MM-DD"): isso e meia-noite UTC, que em Sao Paulo vira o DIA
// ANTERIOR (mesmo bug sistemico ja documentado no CLAUDE.md, secao "bug
// sistemico de fuso horario em campos date-only").
export function formatarDataVisita(dataVisita: string): string {
  const [ano, mes, dia] = dataVisita.split('-').map(Number);
  const diaSemana = DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${diaSemana}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

export interface DadosAvisoAgendamento {
  nomeCliente?: string | null;
  phoneNumber: string;
  dataVisita: string;
  horario: string;
  resumo?: string | null;
}

export function montarAvisoAgendamento(d: DadosAvisoAgendamento): string {
  return (
    `🏠 *Novo agendamento via VIVI!*\n\n` +
    `👤 Cliente: ${d.nomeCliente?.trim() || d.phoneNumber}\n` +
    `📱 WhatsApp: +${d.phoneNumber}\n` +
    `📅 Data: ${formatarDataVisita(d.dataVisita)} às ${d.horario}\n` +
    (d.resumo?.trim() ? `📝 Perfil: ${d.resumo.trim()}\n` : '') +
    `\nAcesse o CRM: https://gestordevendas.ivillar.com.br`
  );
}
