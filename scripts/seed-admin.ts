// scripts/seed-admin.ts
// Script de uso unico para criar o usuario Administrador inicial real.
// Le SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD do .env - nunca loga a senha.
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD precisam estar preenchidos no .env antes de rodar este script.',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Usuario com este e-mail ja existe, nada foi criado: ${email}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: 'Gestor de Vendas - Admin' },
      });

      const role = await tx.role.create({
        data: { name: 'Administrador', tenantId: tenant.id },
      });

      await tx.user.create({
        data: {
          name: 'Administrador',
          email,
          password: hashedPassword,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });
    });

    console.log(`Usuario admin criado com sucesso: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro ao criar usuario admin:', err.message);
  process.exit(1);
});
