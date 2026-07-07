// src/modules/auth/application/use-cases/register-tenant.use-case.ts
import { Injectable, Inject, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ITenantOnboardingRepository } from '../../domain/repositories/user-repository.interface';

interface RegisterTenantInput {
  companyName: string;
  ownerName: string;
  email: string;
  password: string;
}

@Injectable()
export class RegisterTenantUseCase {
  constructor(
    @Inject('ITenantOnboardingRepository')
    private readonly onboardingRepository: ITenantOnboardingRepository,
  ) {}

  async execute(input: RegisterTenantInput) {
    try {
      const hashedPassword = await bcrypt.hash(input.password, 10);

      const result = await this.onboardingRepository.registerCompanyWithOwner({
        companyName: input.companyName,
        ownerName: input.ownerName,
        email: input.email,
        hashedPassword,
      });

      return result;
    } catch (error) {
      // Prisma lanca erro de violacao de unicidade quando o e-mail ja existe
      throw new ConflictException(
        'Nao foi possivel cadastrar a empresa. O e-mail pode ja estar em uso.',
      );
    }
  }
}
