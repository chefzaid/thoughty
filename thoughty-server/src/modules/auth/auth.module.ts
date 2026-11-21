import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, RefreshToken, Diary, SignUpRequest, AccountEvent, Setting, PersonalAccessToken } from '@/database/entities';
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
import {
  AccountActivityController,
  AccountActivityService,
  ClientSoftwareMiddleware,
} from './account-activity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, Diary, SignUpRequest, AccountEvent, Setting, PersonalAccessToken]),
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
  controllers: [AuthController, SignUpController, AccountActivityController],
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
    AccountActivityService,
    ClientSoftwareMiddleware,
  ],
  exports: [AuthService, AccountActivityService, EmailService, EmailVerificationService, TwoFactorService, JwtAuthGuard, JwtModule],
})
export class AuthModule implements NestModule {
  /** Every request knows its browser and system, for the account activity it may record. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ClientSoftwareMiddleware).forRoutes('{*splat}');
  }
}
