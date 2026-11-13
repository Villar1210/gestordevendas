# Contrato — Módulo Campanhas por SMS (repique em massa)

Status: proposto em 13/11/2026 (Villar escolheu: Zenvia, link curto no
gestordevendas.ivillar.com.br, tenant próprio "Novolar").
Primeiro uso: repique dos leads do Novolar Freguesia (543 contatos, últimos 90 dias).

## 1. Objetivo
Disparar um SMS por contato, a partir de uma planilha, com:
- texto personalizado (`{primeiro_nome}`) e **um link curto único por contato**
  (`{link}`), que registra o clique e redireciona para a landing page;
- descadastro automático por resposta (SAIR, PARAR...), que vale para as próximas
  campanhas do mesmo tenant;
- acompanhamento na tela: enviados, entregues, falhas, cliques, respostas, opt-outs;
- exportação de quem clicou ou respondeu, para os corretores darem sequência.

Fora do escopo desta fatia: WhatsApp/e-mail em massa (o Repique do Kanban continua
como está), agendamento por data, testes A/B automáticos, leitura da conversão
na landing page (o link já leva `c=<código>` para isso ser ligado depois).

## 2. Onde fica
- Backend: `src/modules/campanhas_sms/` (Clean Architecture, não importa outro
  módulo de negócio). Não altera o `MessageDispatcherService` compartilhado:
  o canal SMS de lá continua "não implementado" (ligar depois, se o Repique do
  Kanban precisar de SMS).
- Frontend: `frontend/src/features/campanhas/` + `app/dashboard/campanhas/`.
- Migration: `20261113120000_campanhas_sms` (só CREATE TABLE).

## 3. Modelo (por tenant, FK Tenant Cascade)
- `CampanhaSms` (campanhas_sms): nome, mensagem (modelo com variáveis),
  linkDestino (https), status, maxSegmentos (1..3, padrão 1), taxaPorMinuto
  (6..120, padrão 30), janelaInicio/janelaFim (hora local, padrão 9 e 20),
  codigoTeste (código do link do SMS de teste), criadoPorUserId (sem FK),
  iniciadaEm, concluidaEm, timestamps.
- `CampanhaSmsContato` (campanhas_sms_contatos): campanhaId (FK Cascade),
  tenantId, nome, primeiroNome, telefone (`55DDD9XXXXXXXX`), corretor?,
  referencia?, status, codigo (6 caracteres base62, ÚNICO global), tentativas,
  provedorMensagemId?, erro?, enviadoEm?, entregueEm?, cliques,
  primeiroCliqueEm?, ultimoCliqueEm?, respostaTexto? (até 500), respondidoEm?,
  optoutEm?. `@@unique([campanhaId, telefone])`.
- `SmsOptOut` (sms_optouts): tenantId, telefone, origem
  (resposta|manual|importacao), createdAt. `@@unique([tenantId, telefone])`.

## 4. Estados
Campanha: `rascunho → enviando ⇄ pausada → concluida`; `cancelada` a partir de
rascunho/enviando/pausada. Editar mensagem/link/configuração e importar contatos:
só em `rascunho` ou `pausada`.

Contato: `pendente → enviando → enviado → entregue | falhou`;
`bloqueado` (já estava na lista de opt-out na importação ou no envio);
`optout` (respondeu SAIR); `cancelado` (campanha cancelada antes do envio).

## 5. Regras
- **Telefone**: só celular brasileiro. Normaliza para `55` + DDD (11–99) + 9
  dígitos começando com 9. Fixo, curto, DDD inválido → "inválido" (não entra).
- **Importação** (.xlsx — aba "SMS" ou a primeira — ou .csv com `;` ou `,`):
  cabeçalho por nome, sem acento/caixa: `nome`, `primeiro_nome`,
  `telefone|celular|whatsapp`, `corretor`, `referencia|lead|numero_lead`.
  Obrigatório: telefone. Sem `primeiro_nome` → 1ª palavra do nome. Repetido
  (na planilha ou já na campanha) → "duplicado". Número na lista de opt-out →
  entra como `bloqueado`. Limites: arquivo 5 MB, 5.000 contatos por campanha.
  `substituir=true` apaga os contatos atuais (só em rascunho).
- **Mensagem**: precisa ter `{link}`. Variáveis: `{primeiro_nome}` (máx. 12
  caracteres, cortado) e `{link}`. Contagem GSM-7 (160 por SMS; `^{}\[~]|€`
  contam 2) ou UCS-2 (70) se houver qualquer caractere fora do GSM-7 (acento,
  emoji). Iniciar exige que o **pior caso** (maior primeiro nome da lista +
  link) caiba em `maxSegmentos`; senão 422 com o tamanho calculado.
- **Link curto**: `{SHORTLINK_BASE_URL}/{codigo}`. GET público `/r/:codigo` →
  soma o clique (HEAD não conta) e responde 302 para `linkDestino` com
  `c=<codigo>&utm_source=sms&utm_medium=sms&utm_campaign=<id curto>`. Código
  inexistente → página "Link inválido" (404), nunca redireciona para outro lugar.
  Código de teste → redireciona sem contar.
  Limitação conhecida: antivírus de operadora/celular que "abre" o link conta
  como clique.
- **Janela de envio**: segunda a sábado, entre janelaInicio e janelaFim
  (America/Sao_Paulo). Fora dela a campanha fica `enviando` mas o job não envia.
- **Ritmo**: job a cada 15 s, envia até `ceil(taxaPorMinuto / 4)` por campanha.
  Antes de cada envio confere de novo a lista de opt-out.
- **Falhas do provedor**: 4xx = `falhou` na hora; timeout/429/5xx = volta para
  `pendente` e tenta de novo em outra rodada, até 3 tentativas.
  Contato preso em `enviando` (servidor caiu no meio) vira `falhou` com
  "Envio interrompido — confira antes de reenviar". **Nunca reenvia sozinho**,
  para não mandar SMS em dobro.
- **Conclusão**: sem `pendente` nem `enviando` → `concluida`.
- **Resposta do cliente** (webhook): guarda o texto na última mensagem enviada
  àquele número no tenant. Se for palavra de saída — SAIR, PARAR, STOP, CANCELAR,
  DESCADASTRAR, REMOVER, NÃO QUERO, sozinha ou no começo da mensagem — grava
  `SmsOptOut` em todo tenant que mandou SMS para o número nos últimos 60 dias e
  marca `optout` nos contatos pendentes dele.
- **Status de entrega** (webhook): DELIVERED → `entregue`; NOT_DELIVERED/REJECTED
  → `falhou`; SENT só confirma `enviado`.

## 6. Rotas
Autenticadas (`CampanhaSmsController`, `@Controller('campanhas-sms')`, classe
`JwtAuthGuard + RolesGuard + @Roles('Administrador')`, conferido de novo no use
case). Impersonação do Super Usuário: leitura liberada; qualquer escrita → 403
`{ code: 'CAMPANHA_SOMENTE_LEITURA' }`.

| Método | Rota | O que faz |
|---|---|---|
| GET | /campanhas-sms | lista (com contagens) |
| POST | /campanhas-sms | cria rascunho |
| GET | /campanhas-sms/:id | detalhe + métricas + análise da mensagem |
| PATCH | /campanhas-sms/:id | edita (rascunho/pausada) |
| POST | /campanhas-sms/:id/contatos/importar | multipart `file` (+ `substituir`) |
| GET | /campanhas-sms/:id/contatos | lista paginada (`status`, `busca`, `pagina`) |
| GET | /campanhas-sms/:id/contatos.csv | exporta (`filtro=todos|clicou|respondeu|optout|falhou`) |
| POST | /campanhas-sms/:id/teste | `{ telefone }` — envia 1 SMS de teste (5/min por usuário) |
| POST | /campanhas-sms/:id/iniciar | rascunho/pausada → enviando |
| POST | /campanhas-sms/:id/pausar | enviando → pausada |
| POST | /campanhas-sms/:id/cancelar | → cancelada (pendentes viram cancelado) |
| GET | /campanhas-sms/optouts | lista de opt-out do tenant |
| POST | /campanhas-sms/optouts | `{ telefone }` — opt-out manual |

Públicas:
- `GET /r/:codigo` (60/min por IP) — link curto.
- `POST /webhooks/zenvia/sms/:token` — token comparado em tempo constante com
  `ZENVIA_WEBHOOK_TOKEN` (sem a variável → 503; token errado → 404). Sempre 200
  para token certo, mesmo com id desconhecido.

## 7. Provedor
`ISmsProvider.enviar({ para, texto, idExterno }) → { provedorMensagemId }`.
- `ZenviaSmsProvider`: `POST https://api.zenvia.com/v2/channels/sms/messages`,
  header `X-API-TOKEN`, corpo `{ from, to, contents: [{ type: 'text', text }],
  externalId }`, timeout 15 s, redirect não seguido.
- `ConsoleSmsProvider` (padrão): não envia nada, só registra no log (telefone
  mascarado). Serve para testar a campanha inteira sem gastar SMS.

## 8. Variáveis de ambiente (novas)
`SMS_PROVIDER` (`console` | `zenvia`, padrão console), `ZENVIA_API_TOKEN`,
`ZENVIA_SMS_FROM` (remetente/keyword cadastrado na Zenvia),
`ZENVIA_WEBHOOK_TOKEN` (texto aleatório longo), `SHORTLINK_BASE_URL`
(ex.: `https://gestordevendas.ivillar.com.br/r`; padrão `FRONTEND_URL + /api/r`).
Nenhuma dependência nova (usa `exceljs` e `csv-parse`, que já existem).

## 9. LGPD e segurança
- Logs nunca levam telefone completo nem texto do SMS (telefone mascarado).
- Export CSV só para Administrador; contém só o que foi importado + métricas.
- Lista de opt-out é por tenant e é respeitada em todas as campanhas seguintes.
- Base legal e autorização do uso dos dados são responsabilidade do tenant
  (no caso Novolar: autorização formal da empresa para usar o GdV).
- Upload: só .xlsx/.csv por assinatura (ZIP `PK\x03\x04` / texto), 5 MB,
  leitura em streaming com teto de 10.000 linhas.

## 10. Operação (nginx)
Para o link sem `/api`, acrescentar no server do gestordevendas.ivillar.com.br:
`location /r/ { proxy_pass http://127.0.0.1:3333/r/; }`. Sem isso, usar
`SHORTLINK_BASE_URL=https://gestordevendas.ivillar.com.br/api/r` (+4 caracteres).
