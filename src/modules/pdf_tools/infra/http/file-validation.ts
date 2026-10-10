// src/modules/pdf_tools/infra/http/file-validation.ts
// Validacao dos uploads ANTES de chegar aos casos de uso: presenca,
// quantidade, tamanho total e tipo real pelo conteudo (magic bytes).
import { detectFileKind, OFFICE_CONTAINER_BY_EXTENSION } from '../../domain/file-signature';
import { invalidInput, PdfToolsError } from '../../domain/pdf-tools.errors';
import { PDF_TOOLS_LIMITS, MB } from '../../domain/pdf-tools.limits';

export interface UploadedBinary {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype?: string;
}

/** Multer entrega o nome em latin1; navegadores enviam UTF-8. */
export function normalizeOriginalName(name: string | undefined): string {
  if (!name) return 'documento';
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('�') ? name : decoded;
  } catch {
    return name;
  }
}

function toInput(file: UploadedBinary): UploadedBinary {
  return { ...file, originalname: normalizeOriginalName(file.originalname) };
}

export function assertTotalSize(files: UploadedBinary[]): void {
  const total = files.reduce((acc, f) => acc + (f.size ?? f.buffer.length), 0);
  if (total > PDF_TOOLS_LIMITS.maxRequestBytes) {
    throw new PdfToolsError(
      'TOO_LARGE',
      `O total enviado passa de ${PDF_TOOLS_LIMITS.maxRequestBytes / MB} MB. Envie menos arquivos ou arquivos menores.`,
    );
  }
  for (const f of files) {
    if ((f.size ?? f.buffer.length) > PDF_TOOLS_LIMITS.maxFileBytes) {
      throw new PdfToolsError('TOO_LARGE', `Cada arquivo pode ter no máximo ${PDF_TOOLS_LIMITS.maxFileBytes / MB} MB.`);
    }
  }
}

function assertNotEmpty(file: UploadedBinary): void {
  if (!file.buffer || file.buffer.length === 0) {
    throw invalidInput(`O arquivo "${normalizeOriginalName(file.originalname)}" está vazio.`);
  }
}

export function requireSinglePdf(file: UploadedBinary | undefined): UploadedBinary {
  if (!file) throw invalidInput('Envie um arquivo PDF no campo "file".');
  assertTotalSize([file]);
  assertNotEmpty(file);
  if (detectFileKind(file.buffer) !== 'pdf') {
    throw invalidInput(`"${normalizeOriginalName(file.originalname)}" não é um PDF válido.`);
  }
  return toInput(file);
}

export function requirePdfs(files: UploadedBinary[] | undefined): UploadedBinary[] {
  if (!files || files.length === 0) throw invalidInput('Envie os arquivos PDF no campo "files".');
  assertTotalSize(files);
  return files.map((f) => {
    assertNotEmpty(f);
    if (detectFileKind(f.buffer) !== 'pdf') {
      throw invalidInput(`"${normalizeOriginalName(f.originalname)}" não é um PDF válido.`);
    }
    return toInput(f);
  });
}

export function requireImages(files: UploadedBinary[] | undefined): UploadedBinary[] {
  if (!files || files.length === 0) throw invalidInput('Envie as imagens JPG ou PNG no campo "files".');
  assertTotalSize(files);
  return files.map((f) => {
    assertNotEmpty(f);
    const kind = detectFileKind(f.buffer);
    if (kind !== 'jpg' && kind !== 'png') {
      throw invalidInput(`"${normalizeOriginalName(f.originalname)}" não é uma imagem JPG ou PNG válida.`);
    }
    return toInput(f);
  });
}

export function requireOfficeFile(file: UploadedBinary | undefined): UploadedBinary {
  if (!file) throw invalidInput('Envie o documento no campo "file".');
  assertTotalSize([file]);
  assertNotEmpty(file);
  const name = normalizeOriginalName(file.originalname);
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  const expected = OFFICE_CONTAINER_BY_EXTENSION[ext];
  if (!expected) {
    throw invalidInput('Formato não suportado. Envie um arquivo doc, docx, xls, xlsx, ppt, pptx, odt, ods ou odp.');
  }
  if (detectFileKind(file.buffer) !== expected) {
    throw invalidInput(`"${name}" não parece ser um arquivo .${ext} válido.`);
  }
  return { ...file, originalname: name };
}
