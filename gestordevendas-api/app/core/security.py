"""
Autenticação e autorização.

Dois caminhos:
1. JWT Supabase   → Authorization: Bearer <supabase_jwt>  (dashboard)
2. API Key        → Authorization: Bearer wacrm_live_<key> (API pública v1)
"""
import hashlib
import hmac
from typing import Optional

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.supabase import get_supabase_admin
from app.domain.enums import Role
from app.domain.exceptions import ForbiddenError, UnauthorizedError

security_scheme = HTTPBearer(auto_error=False)

# ─── JWT Supabase ─────────────────────────────────────────────────────────────

def decode_supabase_jwt(token: str) -> dict:
    """Decodifica e valida um JWT emitido pelo Supabase Auth."""
    cfg = get_settings()
    try:
        payload = jwt.decode(
            token,
            cfg.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as e:
        raise UnauthorizedError(f"JWT inválido: {e}")


def get_user_id_from_token(token: str) -> str:
    """Extrai o user_id (sub) do JWT."""
    payload = decode_supabase_jwt(token)
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Token sem sub (user_id)")
    return user_id


def get_claims_from_token(token: str) -> dict:
    """
    Retorna o payload completo do JWT Supabase.
    Inclui sub (user_id), email, role, user_metadata, etc.
    """
    return decode_supabase_jwt(token)


# ─── API Key ─────────────────────────────────────────────────────────────────

def hash_api_key(raw_key: str) -> str:
    """SHA-256 do raw key — nunca armazenamos o texto puro."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


def verify_meta_webhook_signature(payload_body: bytes, signature_header: str) -> bool:
    """
    Verifica a assinatura HMAC-SHA256 do webhook da Meta Cloud API.
    signature_header = 'sha256=<hex>'
    """
    cfg = get_settings()
    if not cfg.META_APP_SECRET:
        return False
    expected = "sha256=" + hmac.new(
        cfg.META_APP_SECRET.encode(),
        payload_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


# ─── Dependency: token bruto ──────────────────────────────────────────────────

def get_raw_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> str:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header ausente",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials
