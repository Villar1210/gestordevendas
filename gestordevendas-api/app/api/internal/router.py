"""
Router interno — endpoints do dashboard (autenticados por JWT Supabase).
Cada sub-módulo é registrado aqui à medida que as fases avançam.
"""
from fastapi import APIRouter

# ── Auth & Team (sem prefixo extra — rotas: /api/auth/* e /api/team/*) ────────
from app.api.internal import auth

# ── Fase 2: Core CRM ──────────────────────────────────────────────────────────
from app.api.internal import contacts, conversations, messages

# ── Fase 3: WhatsApp Inboxes ──────────────────────────────────────────────────
from app.api.internal import inboxes

# ── Fase 4: Automations + Broadcasts ─────────────────────────────────────────
from app.api.internal import automations, broadcasts

# ── Fase 5: AI Config + Knowledge Base ───────────────────────────────────────
from app.api.internal import ai_config, knowledge

# ── Fase 6: Chatbot Flows ─────────────────────────────────────────────────────
from app.api.internal import flows

# ── Fase 7: Account & Billing ─────────────────────────────────────────────────
from app.api.internal import account

# ── Módulo Super Usuário: Cross-Tenant Admin ───────────────────────────────────
from app.api.internal import super_user

router = APIRouter(prefix="/api", tags=["internal"])


@router.get("/ping", summary="Ping autenticado")
async def ping():
    """Confirma que o roteador interno está ativo."""
    return {"status": "ok", "router": "internal"}


# ── Auth & Team ───────────────────────────────────────────────────────────────
router.include_router(auth.router)

# ── Fase 2 ────────────────────────────────────────────────────────────────────
router.include_router(contacts.router)
router.include_router(conversations.router)
router.include_router(messages.router)

# ── Fase 3 ────────────────────────────────────────────────────────────────────
router.include_router(inboxes.router)

# ── Fase 4 ────────────────────────────────────────────────────────────────────
router.include_router(automations.router)
router.include_router(broadcasts.router)

# ── Fase 5 ────────────────────────────────────────────────────────────────────
router.include_router(ai_config.router)
router.include_router(knowledge.router)
router.include_router(flows.router)
router.include_router(account.router)

# ── Módulo Super Usuário ──────────────────────────────────────────────────────
router.include_router(super_user.router)

# ── Fases futuras ─────────────────────────────────────────────────────────────
# router.include_router(whatsapp.router,     prefix="/whatsapp",     tags=["WhatsApp"])
# router.include_router(automations.router,  prefix="/automations",  tags=["Automations"])
# router.include_router(flows.router,        prefix="/flows",         tags=["Flows"])
# router.include_router(ai.router,           prefix="/ai",            tags=["AI"])
# router.include_router(broadcasts.router,   prefix="/broadcasts",    tags=["Broadcasts"])
# router.include_router(pipelines.router,    prefix="/pipelines",     tags=["Pipelines"])
# router.include_router(account.router,      prefix="/account",       tags=["Account"])
