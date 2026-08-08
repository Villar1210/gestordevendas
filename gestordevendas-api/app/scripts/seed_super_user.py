"""
Script de seed: Criar Super Usuário.

Uso:
    python -m app.scripts.seed_super_user

Cria:
1. Account especial "Plataforma" (se não existir)
2. Profile como Super Admin nesse Account
3. Marca is_super_user = true na base de dados
"""
import sys
from datetime import datetime
from uuid import uuid4

from app.core.supabase import get_supabase_admin
from app.domain.enums import Plan, Role


def seed_super_user():
    """Cria um Super Usuário na plataforma."""
    db = get_supabase_admin()

    print("🔧 Iniciando seed de Super Usuário...")

    # ─── Passo 1: Verificar se Account "Plataforma" existe ─────────────────────

    print("\n📋 Verificando Account 'Plataforma'...")
    accounts_result = db.table("accounts").select("*").eq("name", "Plataforma").execute()

    if accounts_result.data:
        platform_account = accounts_result.data[0]
        platform_account_id = platform_account["id"]
        print(f"✓ Account 'Plataforma' já existe: {platform_account_id}")
    else:
        # Criar Account "Plataforma"
        platform_account_id = str(uuid4())
        platform_account = {
            "id": platform_account_id,
            "name": "Plataforma",
            "owner_id": None,  # Será preenchido com o Super Admin
            "plan": Plan.ENTERPRISE.value,
            "created_at": datetime.utcnow().isoformat(),
        }
        print(f"📍 Criando Account 'Plataforma'...")
        create_result = db.table("accounts").insert(platform_account).execute()
        if not create_result.data:
            print("❌ Erro ao criar Account 'Plataforma'")
            return False
        print(f"✓ Account 'Plataforma' criado: {platform_account_id}")

    # ─── Passo 2: Verificar se Super Admin já existe ─────────────────────────

    print("\n👤 Verificando perfil Super Admin...")
    profiles_result = db.table("profiles").select("*").eq(
        "account_id", platform_account_id
    ).eq("role", Role.SUPER_ADMIN.value).execute()

    if profiles_result.data:
        super_admin = profiles_result.data[0]
        print(f"✓ Super Admin já existe:")
        print(f"  - ID: {super_admin['id']}")
        print(f"  - Email: {super_admin['email']}")
        print(f"  - Nome: {super_admin['name']}")
        print(f"  - is_super_user: {super_admin.get('is_super_user', False)}")
        return True

    # ─── Passo 3: Criar Super Admin ──────────────────────────────────────────

    print("\n🔐 Criando perfil Super Admin...")

    # Para criar um Super Admin, precisamos:
    # 1. Criar um user no Supabase Auth (ou usar um existente)
    # 2. Criar um Profile com role SUPER_ADMIN

    # Para este seed, vamos criar um Profile com dados básicos
    # Em produção, o Super Admin seria criado via Supabase Auth

    super_admin_id = str(uuid4())
    super_admin_email = "super-admin@plataforma.local"
    super_admin_name = "Super Administrator"

    super_admin_profile = {
        "id": super_admin_id,
        "account_id": platform_account_id,
        "email": super_admin_email,
        "name": super_admin_name,
        "role": Role.SUPER_ADMIN.value,
        "is_super_user": True,  # ← IMPORTANTE: marcar como Super User
        "created_at": datetime.utcnow().isoformat(),
    }

    print(f"📍 Inserindo Profile Super Admin...")
    profile_result = db.table("profiles").insert(super_admin_profile).execute()

    if not profile_result.data:
        print("❌ Erro ao criar Profile Super Admin")
        return False

    print(f"✓ Super Admin criado com sucesso!")
    print(f"\n📌 Detalhes:")
    print(f"  - ID: {super_admin_id}")
    print(f"  - Email: {super_admin_email}")
    print(f"  - Nome: {super_admin_name}")
    print(f"  - Account: Plataforma ({platform_account_id})")
    print(f"  - Role: SUPER_ADMIN")
    print(f"  - is_super_user: true")

    # ─── Passo 4: Atualizar Account com owner_id ────────────────────────────

    print(f"\n🔗 Atualizando Account 'Plataforma' com owner_id...")
    update_result = db.table("accounts").update(
        {"owner_id": super_admin_id}
    ).eq("id", platform_account_id).execute()

    if update_result.data:
        print(f"✓ Account 'Plataforma' atualizado com owner_id")
    else:
        print(f"⚠️  Erro ao atualizar Account com owner_id (não é crítico)")

    # ─── Sucesso! ────────────────────────────────────────────────────────────

    print("\n" + "=" * 60)
    print("✅ SEED DE SUPER USUÁRIO CONCLUÍDO COM SUCESSO!")
    print("=" * 60)
    print(f"\n🎯 Próximos passos:")
    print(f"1. Para acessar como Super Admin, faça login com:")
    print(f"   Email: {super_admin_email}")
    print(f"   (Você precisará criar este usuário no Supabase Auth)")
    print(f"\n2. Endpoints disponíveis:")
    print(f"   - GET  /api/super/dashboard     (estatísticas globais)")
    print(f"   - GET  /api/super/tenants       (listar tenants)")
    print(f"   - POST /api/super/tenants/:id/assume-admin")
    print(f"\n3. Para criar usuários adicionais com role SUPER_ADMIN:")
    print(f"   - Crie o usuário no Supabase Auth")
    print(f"   - Crie o Profile com role=SUPER_ADMIN e is_super_user=true")

    return True


if __name__ == "__main__":
    try:
        success = seed_super_user()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Erro não tratado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
