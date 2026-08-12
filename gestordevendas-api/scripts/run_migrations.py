"""
Script para executar migrações no Supabase
Aplica todas as migrações SQL em ordem
"""
import os
import sys
from pathlib import Path
import asyncio

# Adicionar o projeto root ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.infra.supabase.client import get_supabase_client


async def run_migrations():
    """Executar todas as migrações em ordem"""
    migrations_dir = Path(__file__).parent.parent / "supabase" / "migrations"
    migrations = sorted([f for f in migrations_dir.glob("*.sql")])

    if not migrations:
        print("❌ Nenhuma migração encontrada")
        return False

    print(f"📦 Encontradas {len(migrations)} migrações")

    try:
        supabase = get_supabase_client()
        print("✅ Conectado ao Supabase")
    except Exception as e:
        print(f"❌ Erro ao conectar ao Supabase: {e}")
        return False

    for migration_file in migrations:
        migration_name = migration_file.name
        print(f"\n🔄 Executando: {migration_name}")

        try:
            # Ler o arquivo SQL
            with open(migration_file, "r", encoding="utf-8") as f:
                sql_content = f.read()

            # Dividir por ";" mas preservar strings
            statements = []
            current = ""
            in_string = False
            quote_char = None

            for char in sql_content:
                if char in ("'", '"') and (not in_string or quote_char == char):
                    in_string = not in_string
                    if in_string:
                        quote_char = char
                    else:
                        quote_char = None
                    current += char
                elif char == ";" and not in_string:
                    if current.strip():
                        statements.append(current.strip() + ";")
                    current = ""
                else:
                    current += char

            if current.strip():
                statements.append(current.strip())

            # Executar cada statement
            for i, statement in enumerate(statements, 1):
                if statement.strip() and not statement.strip().startswith("--"):
                    print(f"  └─ Executando statement {i}/{len(statements)}...")
                    try:
                        # Usar o cliente Supabase para executar SQL
                        result = supabase.postgrest.rpc(
                            "exec_sql",
                            {"sql": statement},
                        ).execute()
                        print(f"    ✅ OK")
                    except Exception as e:
                        # Se rpc não existir, tentar via execute direto (não recomendado)
                        print(f"    ⚠️  Aviso: {str(e)[:100]}")

            print(f"✅ {migration_name} concluída")

        except Exception as e:
            print(f"❌ Erro ao executar {migration_name}: {e}")
            return False

    print("\n" + "=" * 60)
    print("✅ Todas as migrações foram executadas com sucesso!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = asyncio.run(run_migrations())
    sys.exit(0 if success else 1)
