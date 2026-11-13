# Runbook — primeiro disparo de SMS (repique Novolar Freguesia)

Passo a passo do zero até o primeiro SMS. Ordem importa: faça cada etapa
inteira antes da próxima. Contrato do módulo: `CONTRATO_CAMPANHA_SMS.md`.

## 0. Antes de tudo (fora do sistema)
- [ ] **Autorização da Novolar/Patrimar** para tratar os contatos dos leads no
      Gestor de Vendas (o ideal é um termo simples de operador de dados — LGPD).
- [ ] Jurídico/marketing de acordo com o disparo para quem **não marcou o aceite
      de comunicações** (503 dos 543 contatos). A planilha tem a coluna
      `aceite_comunicacoes` para separar, se a decisão for mandar só para quem aceitou.
- [ ] Texto final do SMS aprovado (sem acento, com `{link}` e "SAIR p/ parar").

## 1. Conta na Zenvia (~1 dia útil)
1. Criar conta em https://app.zenvia.com e contratar/ativar o canal **SMS**.
2. Cadastrar o **remetente** (keyword/ID do canal SMS) — é o valor de `ZENVIA_SMS_FROM`.
3. Em *Desenvolvedores → Tokens*, criar um token de API — é o `ZENVIA_API_TOKEN`.
   Guarde num gerenciador de senhas; nunca cole em chat, e-mail ou commit.
4. Gerar um texto aleatório longo para o webhook (ex.: `openssl rand -hex 24`) —
   é o `ZENVIA_WEBHOOK_TOKEN`.
5. Em *Desenvolvedores → Webhooks*, criar **dois** webhooks do canal SMS, ambos com a URL
   `https://gestordevendas.ivillar.com.br/api/webhooks/zenvia/sms/<ZENVIA_WEBHOOK_TOKEN>`:
   - evento **MESSAGE_STATUS** (confirmação de entrega)
   - evento **MESSAGE** (respostas — é por aqui que chega o "SAIR")

## 2. Servidor (VPS)
No `/var/www/gestordevendas/app/.env` (o `.env` lido pelo NestJS), acrescentar:
```
SMS_PROVIDER=zenvia
ZENVIA_API_TOKEN=<token da Zenvia>
ZENVIA_SMS_FROM=<remetente>
ZENVIA_WEBHOOK_TOKEN=<texto aleatório do passo 1.4>
SHORTLINK_BASE_URL=https://gestordevendas.ivillar.com.br/r
```
> Dica: suba **primeiro sem** `SMS_PROVIDER=zenvia` (modo simulação) e faça os
> passos 4 a 6 inteiros. Só depois troque para `zenvia` e reinicie.

nginx (`/etc/nginx/sites-enabled/gestordevendas.ivillar.com.br`), dentro do
`server` do HTTPS, **antes** do `location /`:
```
location /r/ {
    proxy_pass http://127.0.0.1:3333/r/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
`sudo nginx -t && sudo systemctl reload nginx`.
Sem essa regra, use `SHORTLINK_BASE_URL=https://gestordevendas.ivillar.com.br/api/r`
(o link fica 4 caracteres maior — confira o contador da tela).

Deploy (backend e frontend):
```
cd /var/www/gestordevendas
git fetch origin && git checkout <branch ou main com o merge>
npm ci
npx prisma migrate deploy
npm run db:generate
npm run build
pm2 restart gestordevendas --update-env
cd frontend && npm ci && rm -rf .next && npm run build && pm2 restart gestordevendas-frontend --update-env
```
NUNCA `pm2 restart all`. Conferir: `pm2 logs gestordevendas --lines 50` sem erro
e `curl -I https://gestordevendas.ivillar.com.br/r/AAAAAA` → **404** (página
"Link inválido" = rota no ar).

## 3. Empresa (tenant) "Novolar" no GdV
Só o Super Usuário cria empresa. Com o token do Super Usuário (login normal):
```
curl -X POST https://gestordevendas.ivillar.com.br/api/auth/register \
  -H "Authorization: Bearer <token do Super Usuário>" -H "Content-Type: application/json" \
  -d '{"companyName":"Novolar","ownerName":"Daniel Villar","email":"<seu e-mail Novolar>","password":"<senha forte>"}'
```
Entrar com esse login: ele é o **Administrador** da Novolar e vê o menu
**Campanhas SMS**. Os dados da Novolar ficam separados dos outros clientes.

## 4. Montar a campanha (tela Campanhas SMS)
1. **Nova campanha** → nome, mensagem (o contador mostra o pior caso, tem que
   ficar verde e em 1 SMS), página de destino `https://freguesia.ivillar.com.br`.
2. **Importar planilha** → `repique_freguesia_90dias.xlsx` (usa a aba "SMS").
   Confira o resumo: importados, inválidos, repetidos, bloqueados.
3. Ritmo: comece com **30 SMS/min** (543 contatos ≈ 18 min).

## 5. Teste
1. **Enviar teste** para o seu celular. Confira: texto, nome, link abre a
   landing page (o link de teste não conta clique).
2. Responda **SAIR** ao SMS de teste → em alguns segundos o seu número aparece em
   opt-out (`GET /api/campanhas-sms/optouts` ou numa próxima importação ele entra
   como "bloqueado"). Isso prova que o webhook está chegando.

## 6. Disparo e acompanhamento
1. **Disparar campanha** → confirmar. Os números atualizam sozinhos a cada 10 s.
2. Horário: segunda a sábado, das 9h às 20h. Fora disso a fila espera.
3. **Pausar** a qualquer momento (para tudo na próxima rodada de 15 s).
4. Depois do disparo: **Quem clicou (.csv)** e **Quem respondeu (.csv)** → mandar
   para os corretores (cada linha já tem o corretor do lead).

## Se algo der errado
- "O provedor de SMS não está configurado" → faltou `ZENVIA_API_TOKEN`/`ZENVIA_SMS_FROM`
  com `SMS_PROVIDER=zenvia`, ou não reiniciou com `--update-env`.
- Muitas falhas "Zenvia recusou (HTTP 401/403)" → token errado ou canal não ativo.
- Servidor reiniciou no meio do envio → os contatos que estavam "enviando" viram
  **Falhou — Envio interrompido**. Não são reenviados sozinhos (evita SMS em dobro):
  confira na Zenvia se saiu antes de reenviar.
- Ninguém aparece em "Entregues" → webhook MESSAGE_STATUS não configurado ou token
  da URL diferente do `ZENVIA_WEBHOOK_TOKEN`.
