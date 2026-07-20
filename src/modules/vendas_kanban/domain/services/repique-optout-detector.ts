// src/modules/vendas_kanban/domain/services/repique-optout-detector.ts
// Camada de DOMINIO: funcao pura, sem Prisma/NestJS. Deteccao de pedido de
// descadastro (opt-out, LGPD) por PALAVRAS-CHAVE - deliberadamente NAO
// decidido pela IA (mesmo principio ja aplicado em classificar-renda.ts:
// uma decisao de negocio/compliance critica precisa ser deterministica e
// auditavel, nao discricionaria do modelo). "Reconhecimento razoavel, nao
// so match exato" (ver ProcessIncomingMessageUseCase) - risco aceito de
// falso positivo ocasional (ex: "vou sair de casa" contendo "sair"): o
// pior caso e parar uma campanha de remarketing por engano, nao um dano
// serio, e so se aplica a leads ja depositados no Repique.
const PALAVRAS_OPT_OUT = [
  'sair',
  'descadastr',
  'nao quero mais receber',
  'nao quero receber mais',
  'pare de enviar',
  'parar de receber',
  'pare de mandar',
  'nao me mande mais',
  'nao mandem mais',
  'remover da lista',
  'cancelar inscricao',
  'tirar da lista',
];

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ehPedidoDeOptOut(mensagem: string): boolean {
  const normalizada = normalizarTexto(mensagem);
  return PALAVRAS_OPT_OUT.some((palavra) => normalizada.includes(palavra));
}
