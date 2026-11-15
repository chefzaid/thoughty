import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, RefreshToken, Diary, SignUpRequest } from '@/database/entities';
import { AuthController } from './auth.controller';
import { SignUpController } from './sign-up.controller';
import {
  AccountService,
  AuthService,
  AuthSessionService,
  EmailService,
  EmailVerificationService,
  IdentityVerificationService,
  PasswordService,
  ProviderAccountService,
  SignUpService,
  TwoFactorService,
} from './services';
import { JwtStrategy } from './strategies';
import { JwtAuthGuard } from './guards';
import { getSigningSecret } from './auth-secrets';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, Diary, SignUpRequest]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: getSigningSecret(configService, 'JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_EXPIRES_IN',
            '15m',
          ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController, SignUpController],
  providers: [
    AuthService,
    AuthSessionService,
    IdentityVerificationService,
    PasswordService,
    ProviderAccountService,
    AccountService,
    EmailService,
    EmailVerificationService,
    SignUpService,
    TwoFactorService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [AuthService, EmailService, EmailVerificationService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
