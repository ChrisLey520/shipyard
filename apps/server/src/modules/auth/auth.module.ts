import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailService } from './mail.service';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password.hasher';
import { PrismaAuthPersistence } from './infrastructure/prisma-auth.persistence';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { AUTH_PERSISTENCE } from './application/ports/auth-persistence.port';
import { AUTH_PASSWORD_RESET_MAILER } from './application/ports/auth-password-reset-mailer.port';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env['JWT_SECRET'] ?? 'change-me-in-production',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [
    MailService,
    BcryptPasswordHasher,
    PrismaAuthPersistence,
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: AUTH_PERSISTENCE, useClass: PrismaAuthPersistence },
    { provide: AUTH_PASSWORD_RESET_MAILER, useExisting: MailService },
    AuthService,
    JwtStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, MailService],
})
export class AuthModule {}
