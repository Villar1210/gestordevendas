"""
Backup e Restore da Base de Dados
Realiza backups automáticos e permite restore
"""
import os
import sys
import gzip
import json
from pathlib import Path
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.infra.supabase.client import get_supabase_client


async def create_backup():
    """Criar backup completo do banco"""
    print("📦 Iniciando backup...")

    try:
        supabase = get_supabase_client()
        print("✅ Conectado ao Supabase")
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        return False

    # Backup timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = Path("backups")
    backup_dir.mkdir(exist_ok=True)

    backup_file = backup_dir / f"backup_{timestamp}.json.gz"

    backup_data = {}

    # Tabelas para fazer backup
    tables = [
        "accounts",
        "profiles",
        "message_templates",
        "cards",
        "knowledge_base",
        "knowledge_embeddings",
        "metrics",
        "analytics_events",
        "daily_summaries",
        "tenant_settings",
    ]

    for table in tables:
        print(f"  📥 Fazendo backup de '{table}'...")

        try:
            # Buscar todos os registros da tabela
            result = supabase.table(table).select("*").execute()
            backup_data[table] = result.data if result.data else []
            print(f"    ✅ {len(backup_data[table])} registros")
        except Exception as e:
            print(f"    ⚠️  Erro ao fazer backup de {table}: {str(e)[:100]}")
            backup_data[table] = []

    # Comprimir e salvar
    try:
        json_data = json.dumps(backup_data, indent=2, default=str)
        with gzip.open(backup_file, "wt", encoding="utf-8") as f:
            f.write(json_data)

        file_size = backup_file.stat().st_size
        print(f"\n✅ Backup criado: {backup_file}")
        print(f"   Tamanho: {file_size / (1024*1024):.2f} MB")

        # Manter apenas os últimos 10 backups
        backups = sorted(backup_dir.glob("backup_*.json.gz"))
        if len(backups) > 10:
            for old_backup in backups[:-10]:
                old_backup.unlink()
                print(f"   🗑️  Removido backup antigo: {old_backup.name}")

        return True

    except Exception as e:
        print(f"❌ Erro ao salvar backup: {e}")
        return False


async def restore_backup(backup_file: str):
    """Restaurar backup completo"""
    print(f"📦 Restaurando backup: {backup_file}")

    backup_path = Path(backup_file)
    if not backup_path.exists():
        print(f"❌ Arquivo não encontrado: {backup_file}")
        return False

    try:
        supabase = get_supabase_client()
        print("✅ Conectado ao Supabase")
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        return False

    # Descomprimir e carregar
    try:
        with gzip.open(backup_path, "rt", encoding="utf-8") as f:
            backup_data = json.load(f)

        print(f"✅ Backup carregado")

        # Restaurar cada tabela
        for table, records in backup_data.items():
            if not records:
                print(f"  ⏭️  {table}: sem registros")
                continue

            print(f"  📤 Restaurando '{table}'...")

            try:
                # Limpar tabela (cuidado!)
                supabase.table(table).delete().neq("id", "").execute()

                # Inserir registros
                for i in range(0, len(records), 100):  # Batch de 100
                    batch = records[i : i + 100]
                    supabase.table(table).insert(batch).execute()

                print(f"    ✅ {len(records)} registros restaurados")

            except Exception as e:
                print(f"    ⚠️  Erro ao restaurar {table}: {str(e)[:100]}")

        print("\n✅ Restore concluído!")
        return True

    except Exception as e:
        print(f"❌ Erro ao restaurar: {e}")
        return False


def list_backups():
    """Listar todos os backups disponíveis"""
    backup_dir = Path("backups")

    if not backup_dir.exists():
        print("Nenhum backup encontrado")
        return

    backups = sorted(backup_dir.glob("backup_*.json.gz"), reverse=True)

    print("📦 Backups disponíveis:\n")
    for i, backup in enumerate(backups, 1):
        size_mb = backup.stat().st_size / (1024 * 1024)
        mtime = datetime.fromtimestamp(backup.stat().st_mtime)
        print(f"{i}. {backup.name}")
        print(f"   Tamanho: {size_mb:.2f} MB")
        print(f"   Data: {mtime.strftime('%Y-%m-%d %H:%M:%S')}\n")


if __name__ == "__main__":
    import asyncio

    if len(sys.argv) < 2:
        print("Uso:")
        print("  python backup_restore.py backup      # Criar backup")
        print("  python backup_restore.py restore <arquivo>  # Restaurar")
        print("  python backup_restore.py list        # Listar backups")
        sys.exit(1)

    command = sys.argv[1]

    if command == "backup":
        success = asyncio.run(create_backup())
    elif command == "restore" and len(sys.argv) >= 3:
        success = asyncio.run(restore_backup(sys.argv[2]))
    elif command == "list":
        list_backups()
        success = True
    else:
        print("❌ Comando inválido")
        success = False

    sys.exit(0 if success else 1)
