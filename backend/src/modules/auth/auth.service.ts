import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserStatus } from '@prisma/client';
import type { Role } from '@ats/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { JwtPayload } from './strategies/jwt.strategy';

export const REFRESH_COOKIE_NAME = 'ats_rt';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenMaxAgeMs: number;
  user: AuthUser;
}

/** Hash dùng để so sánh khi email không tồn tại → cân bằng thời gian phản hồi. */
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: JwtSignOptions['expiresIn'];
  private readonly refreshMaxAgeMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
    this.jwtExpiresIn = this.config.get<string>(
      'JWT_EXPIRES_IN',
      '15m',
    ) as JwtSignOptions['expiresIn'];
    this.refreshMaxAgeMs = parseDurationToMs(
      this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN', '7d'),
    );
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Luôn chạy bcrypt.compare để không lộ email nào tồn tại (timing attack)
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !ok) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị tạm ngưng');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
  }

  /** Rotation: refresh token cũ bị vô hiệu ngay khi cấp token mới. */
  async refresh(rawToken: string | undefined): Promise<AuthResult> {
    if (!rawToken) throw new UnauthorizedException('Thiếu refresh token');

    const user = await this.prisma.user.findFirst({
      where: { refreshTokenHash: hashToken(rawToken), status: UserStatus.ACTIVE },
    });

    if (!user) throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã bị thu hồi');

    return this.issueTokens({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.user.updateMany({
      where: { refreshTokenHash: hashToken(rawToken) },
      data: { refreshTokenHash: null },
    });
  }

  async me(userId: number): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khoá');
    }

    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  }

  getRefreshMaxAgeMs(): number {
    return this.refreshMaxAgeMs;
  }

  private async issueTokens(user: AuthUser): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresIn,
    });

    // Refresh token là chuỗi ngẫu nhiên opaque (không phải JWT) → dễ thu hồi
    const refreshToken = randomBytes(48).toString('base64url');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: hashToken(refreshToken) },
    });

    return { accessToken, refreshToken, refreshTokenMaxAgeMs: this.refreshMaxAgeMs, user };
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** '7d' | '15m' | '3600s' → milliseconds. */
export function parseDurationToMs(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * (multipliers[unit] ?? 1000);
}
