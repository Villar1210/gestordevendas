# Encryption — Documentação

> **Criptografia automática de dados sensíveis (PII)**

## 📋 Visão Geral

O sistema de **Field Encryption** garante que:

1. ✅ Dados sensíveis são criptografados no banco
2. ✅ Criptografia transparente (automática)
3. ✅ Descriptografia automática ao ler
4. ✅ Compliance com GDPR/LGPD/CCPA
5. ✅ Proteção contra SQL injection

## 🔐 Dados Protegidos

| Tipo | Campos |
|------|--------|
| **Contact** | email, phone, cpf, cnpj, address |
| **Person** | email, phone, cpf, birth_date, address |
| **User** | email, phone |
| **Bank** | account_number, routing_number |

## 💻 Uso

### Básico

```python
from app.core.encryption import EncryptedContact

# Ao salvar
contact = {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234"
}

encrypted = EncryptedContact.encrypt(contact)
await db.create(Contact, encrypted)

# Ao ler
contact = await db.get(Contact, id)
decrypted = EncryptedContact.decrypt(contact)
```

### Em Repository

```python
class ContactRepository:
    async def create(self, data: dict) -> Contact:
        encrypted = EncryptedContact.encrypt(data)
        return await db.create(Contact, encrypted)

    async def get(self, contact_id: str) -> dict:
        contact = await db.get(Contact, contact_id)
        return EncryptedContact.decrypt(contact)
```

## 🔧 Configuração

### Gerar chave

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Definir em .env

```env
ENCRYPTION_KEY=your-generated-key-here
```

### Em .env.example

```env
# Gerar com: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=your-key-here
```

## 🧪 Testes

```bash
pytest tests/core/test_encryption.py -v

# 11 testes validam:
# - Criptografia/descriptografia
# - Múltiplos campos
# - Valores None
# - Múltiplos registros
# - Tratamento de erros
```

---

**Versão:** 1.0.0
