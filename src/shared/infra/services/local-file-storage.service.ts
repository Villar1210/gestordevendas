// src/shared/infra/services/local-file-storage.service.ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  IFileStorageService,
  UploadFileInput,
  UploadFileOutput,
} from '../../domain/services/file-storage.interface';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'imoveis');

@Injectable()
export class LocalFileStorageService implements IFileStorageService {
  async upload(file: UploadFileInput): Promise<UploadFileOutput> {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const filename = `${randomUUID()}-${file.originalname}`;
    await writeFile(join(UPLOAD_DIR, filename), file.buffer);

    return { url: `/uploads/imoveis/${filename}` };
  }
}
