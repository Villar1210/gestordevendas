// src/modules/pdf_tools/infra/services/temp-workspace.ts
// Pasta temporaria privada (mkdtemp, permissao 0700) por operacao, SEMPRE
// apagada no finally. Nunca usa /uploads (que e publico).
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

export async function withTempDir<T>(prefix: string, task: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `pdftools-${prefix}-`));
  try {
    await fs.chmod(dir, 0o700);
    return await task(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}
