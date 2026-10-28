import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuthService, REFRESH_COOKIE_NAME, type AuthResult } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieBase: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieBase = {
      httpOnly: true,
      secure: config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng email + mật khẩu' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResult, 'refreshToken' | 'refreshTokenMaxAgeMs'>> {
    const result = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(res, result);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cấp access token mới từ refresh cookie (rotation)' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResult, 'refreshToken' | 'refreshTokenMaxAgeMs'>> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const result = await this.auth.refresh(token);
    this.setRefreshCookie(res, result);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Thu hồi refresh token và xoá cookie' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieBase);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thông tin người dùng đang đăng nhập' })
  async me(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) throw new UnauthorizedException();
    return this.auth.me(user.userId);
  }

  private setRefreshCookie(res: Response, result: AuthResult): void {
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...this.cookieBase,
      maxAge: result.refreshTokenMaxAgeMs,
    });
  }
}
