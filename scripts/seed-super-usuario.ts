// scripts/seed-super-usuario.ts
// Script de uso manual para criar (ou adicionar mais um) Super Usuario -
// dono da plataforma SaaS, acessa todos os tenants via impersonacao (ver
// src/modules/super_usuario). NUNCA exposto como rota HTTP/cadastro
// publico - a Role "Super Usuario" so pode nascer por aqui. Le
// SEED_SUPER_USUARIO_EMAIL/SEED_SUPER_USUARIO_PASSWORD do .env - nunca
// loga a senha. Idempotente em relacao ao tenant/Role "Plataforma": so
// cria o User novo se o tenant/role ja existirem de uma execucao anterior.
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SUPER_USUARIO_ROLE_NAME, PLATAFORMA_TENANT_NOME } from '../src/shared/domain/constants/super-usuario';

async function main() {
  const email = process.env.SEED_SUPER_USUARIO_EMAIL;
  const password = process.env.SEED_SUPER_USUARIO_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'SEED_SUPER_USUARIO_EMAIL e SEED_SUPER_USUARIO_PASSWORD precisam estar preenchidos no .env antes de rodar este script.',
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
      let tenant = await tx.tenant.findFirst({
        where: { roles: { some: { name: SUPER_USUARIO_ROLE_NAME } } },
      });
      if (!tenant) {
        tenant = await tx.tenant.create({ data: { name: PLATAFORMA_TENANT_NOME } });
      }

      let role = await tx.role.findFirst({
        where: { tenantId: tenant.id, name: SUPER_USUARIO_ROLE_NAME },
      });
      if (!role) {
        role = await tx.role.create({
          data: { name: SUPER_USUARIO_ROLE_NAME, tenantId: tenant.id },
        });
      }

      await tx.user.create({
        data: {
          name: 'Super Usuario',
          email,
          password: hashedPassword,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });
    });

    console.log(`Super Usuario criado com sucesso: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro ao criar Super Usuario:', err.message);
  process.exit(1);
});
