// src/modules/bii/infra/providers/exceljs-tmp.ts
// O WorkbookReader do exceljs, quando a aba vem ANTES do xl/sharedStrings.xml
// no ZIP (caso do arquivo da Prefeitura e do proprio exceljs), descompacta
// cada aba para um arquivo temporario via tmp.file(cb) em os.tmpdir() (modo
// 0o600 do pacote tmp) e so apaga ao terminar de ler AQUELA aba - em erro ou
// abort no meio, os arquivos ficam ate o processo sair.
//
// Tentativa de mandar esses arquivos para a pasta 0o700 do ITBI (opcao
// tmpdir do tmp.file): QUEBRA o exceljs. Com a opcao, o tmp faz um
// fs.realpath (1 lstat por componente do caminho) antes do callback; essa
// pequena demora faz o WorkbookReader perder a ultima entrada do ZIP
// (xl/workbook.xml) e falhar com "Cannot read properties of undefined
// (reading 'sheets')" - reproduzido de forma deterministica com pastas de 2+
// niveis. Trocar TMPDIR do processo teria o mesmo efeito e ainda mudaria o
// /tmp de todos os modulos. Por isso: os arquivos continuam no os.tmpdir()
// e este modulo so REGISTRA (sem mudar opcoes nem o tempo do callback) os
// caminhos criados durante uma leitura, para o leitor apagar no finally.
// Escopo por AsyncLocalStorage: so as chamadas feitas dentro de
// comRegistroDeTemporarios(...) sao registradas; o resto fica identico. O
// tamanho total ja foi limitado antes (inspecionarZip: 1,5 GiB reais).
// O modulo "tmp" e resolvido a partir do proprio exceljs (mesma instancia).
import { AsyncLocalStorage } from 'async_hooks';
import { dirname } from 'path';

type TmpFile = (...args: unknown[]) => unknown;
type CallbackTmp = (erro: Error | null, caminho?: string, ...resto: unknown[]) => void;

const contexto = new AsyncLocalStorage<Set<string>>();
let instalado = false;

function moduloTmpDoExceljs(): { file: TmpFile } {
  const base = dirname(require.resolve('exceljs/package.json'));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(require.resolve('tmp', { paths: [base] }));
}

export function instalarRegistroTmpDoExceljs(): void {
  if (instalado) return;
  const tmp = moduloTmpDoExceljs();
  const original = tmp.file;
  tmp.file = function registro(this: unknown, ...args: unknown[]) {
    const registrados = contexto.getStore();
    if (!registrados) return original.apply(this, args);
    const i = typeof args[0] === 'function' ? 0 : 1;
    const cb = args[i] as CallbackTmp;
    const novos = [...args];
    novos[i] = (erro: Error | null, caminho?: string, ...resto: unknown[]) => {
      if (!erro && caminho) registrados.add(caminho);
      cb(erro, caminho, ...resto);
    };
    return original.apply(this, novos);
  };
  instalado = true;
}

// Executa fn registrando em 'registrados' todo temporario criado pelo exceljs
// (inclusive nas continuacoes assincronas).
export function comRegistroDeTemporarios<T>(registrados: Set<string>, fn: () => T): T {
  instalarRegistroTmpDoExceljs();
  return contexto.run(registrados, fn);
}
