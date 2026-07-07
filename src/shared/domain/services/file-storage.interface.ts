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
}
