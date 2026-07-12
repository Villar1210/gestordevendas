// src/modules/edoc/edoc.module.ts
import { Module } from '@nestjs/common';
import { EnvelopeController } from './infra/http/envelope.controller';
import { EdocStatsController } from './infra/http/edoc-stats.controller';
import { SignPublicController } from './infra/http/sign-public.controller';
import { CreateEnvelopeUseCase } from './application/use-cases/create-envelope.use-case';
import { SendEnvelopeUseCase } from './application/use-cases/send-envelope.use-case';
import { GetEnvelopeByTokenUseCase } from './application/use-cases/get-envelope-by-token.use-case';
import { SignDocumentUseCase } from './application/use-cases/sign-document.use-case';
import { CancelEnvelopeUseCase } from './application/use-cases/cancel-envelope.use-case';
import { ListEnvelopesUseCase } from './application/use-cases/list-envelopes.use-case';
import { GetEnvelopeDetailUseCase } from './application/use-cases/get-envelope-detail.use-case';
import { GetEnvelopeForEditUseCase } from './application/use-cases/get-envelope-for-edit.use-case';
import { UpdateEnvelopeDraftUseCase } from './application/use-cases/update-envelope-draft.use-case';
import { GetSignedPdfUseCase } from './application/use-cases/get-signed-pdf.use-case';
import { GenerateSignedPdfUseCase } from './application/use-cases/generate-signed-pdf.use-case';
import { GetEnvelopeStatsUseCase } from './application/use-cases/get-envelope-stats.use-case';
import { PrepareEnvelopeDocumentService } from './application/services/prepare-envelope-document.service';
import { PrismaSignatureEnvelopeRepository } from './infra/database/prisma-signature-envelope.repository';
import { PrismaSignatureRecipientRepository } from './infra/database/prisma-signature-recipient.repository';
import { PrismaSignatureFieldRepository } from './infra/database/prisma-signature-field.repository';
import { PrismaSignatureEventRepository } from './infra/database/prisma-signature-event.repository';
import { PrismaService } from '../../config/prisma.service';
import { LocalFileStorageService } from '../../shared/infra/services/local-file-storage.service';
import { ResendEmailSender } from '../../shared/infra/services/resend-email-sender';
import { LibreOfficeConverterService } from './infra/services/libreoffice-converter.service';

@Module({
  controllers: [EnvelopeController, EdocStatsController, SignPublicController],
  providers: [
    PrismaService,
    CreateEnvelopeUseCase,
    SendEnvelopeUseCase,
    GetEnvelopeByTokenUseCase,
    SignDocumentUseCase,
    CancelEnvelopeUseCase,
    ListEnvelopesUseCase,
    GetEnvelopeDetailUseCase,
    GetEnvelopeForEditUseCase,
    UpdateEnvelopeDraftUseCase,
    GetSignedPdfUseCase,
    GenerateSignedPdfUseCase,
    GetEnvelopeStatsUseCase,
    PrepareEnvelopeDocumentService,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma / disco local).
    { provide: 'ISignatureEnvelopeRepository', useClass: PrismaSignatureEnvelopeRepository },
    { provide: 'ISignatureRecipientRepository', useClass: PrismaSignatureRecipientRepository },
    { provide: 'ISignatureFieldRepository', useClass: PrismaSignatureFieldRepository },
    { provide: 'ISignatureEventRepository', useClass: PrismaSignatureEventRepository },
    // Reaproveita o mesmo servico de disco local do modulo gestao_imobiliaria
    // (mesma interface IFileStorageService) - os PDFs ficam fisicamente em
    // uploads/imoveis/ junto com fotos de imoveis (pasta compartilhada por
    // hoje usar a mesma implementacao concreta; trocar para S3 no futuro
    // afeta os dois modulos igualmente, sem mudar nenhum caso de uso).
    { provide: 'IFileStorageService', useClass: LocalFileStorageService },
    // ResendEmailSender (mesma implementacao ja usada no AuthModule) - e-mail
    // de convite/repasse de assinatura agora e real.
    { provide: 'IEmailSender', useClass: ResendEmailSender },
    // Fatia 4: conversao Word/Excel -> PDF via LibreOffice headless (ver
    // LIBREOFFICE_PATH no .env.example) - troca de implementacao futura
    // (ex: um servico de conversao em nuvem) so mexe aqui.
    { provide: 'IDocumentConverterService', useClass: LibreOfficeConverterService },
  ],
  // Exportado para o modulo portal_cliente: GetMinhasAssinaturasPendentesUseCase
  // e GetMeusDocumentosAssinadosUseCase buscam SignatureRecipient pelo
  // e-mail do usuario logado.
  exports: ['ISignatureRecipientRepository'],
})
export class EdocModule {}
