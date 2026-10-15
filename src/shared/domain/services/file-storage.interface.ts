// src/shared/domain/services/file-storage.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe disco local, S3, etc.

export interface UploadFileInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface UploadFileOutput {
  url: string;
}

export interface IFileStorageService {
  upload(file: UploadFileInput): Promise<UploadFileOutput>;
  // Le de volta os bytes de um arquivo ja armazenado, a partir da url
  // retornada por upload() - usado pelo modulo E-doc para reabrir o PDF
  // original e gerar o PDF final assinado (pdf-lib).
  download(url: string): Promise<Buffer>;
  // OPCIONAL: apaga um arquivo ja armazenado, a partir da url de upload().
  // Arquivo inexistente nao e erro. LocalFileStorageService so apaga arquivos
  // do BOOK do empreendimento (nome "book-<uuid>...") dentro da pasta de
  // uploads - qualquer outro e recusado com aviso (fotos/documentos seguem
  // nunca sendo apagados do disco). Quem chama trata como melhor esforco.
  delete?(url: string): Promise<void>;
}
