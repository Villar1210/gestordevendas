// test/jest.setup.ts
// Roda antes de QUALQUER arquivo de teste (unitario ou integracao) - carrega
// .env.test (banco de teste dedicado, crm_core_db_test, ver CLAUDE.md/
// decisao tomada com o usuario) por cima de qualquer .env ja carregado, para
// que PrismaService (que le process.env.DATABASE_URL direto no construtor)
// nunca aponte para o banco de desenvolvimento durante os testes. Inofensivo
// para testes unitarios que nao tocam o banco.
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });
