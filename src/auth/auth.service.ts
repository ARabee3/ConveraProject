import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  OnModuleDestroy,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshDto } from './dto/refresh.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService implements OnModuleDestroy {
  private redis: Redis;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    console.log('REDIS_URL in AuthService:', redisUrl);
    this.redis = new Redis(redisUrl || 'redis://localhost:6379', { maxRetriesPerRequest: 1 });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;
    const existingUser = await this.usersService.user({ email });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await this.usersService.createUser({
      email,
      passwordHash,
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:verify:${email}`;
    await this.redis.set(key, JSON.stringify({ code: otp, attempts: 0 }), 'EX', 15 * 60);

    console.log(`Mock Email: OTP for ${email} is ${otp}`);

    return { message: 'User registered successfully. Please verify your email.' };
  }

  async verifyOtp(verifyDto: VerifyOtpDto) {
    const { email, code } = verifyDto;
    const key = `otp:verify:${email}`;
    const dataString = await this.redis.get(key);

    if (!dataString) {
      throw new BadRequestException('OTP expired or invalid');
    }

    const data = JSON.parse(dataString) as { code: string; attempts: number };
    if (data.attempts >= 3) {
      await this.redis.del(key);
      throw new BadRequestException('Too many invalid attempts. Request a new OTP.');
    }

    if (data.code !== code) {
      data.attempts += 1;
      await this.redis.set(key, JSON.stringify(data), 'KEEPTTL');
      throw new BadRequestException('Invalid OTP');
    }

    await this.redis.del(key);

    await this.usersService.updateUser({
      where: { email },
      data: { isVerified: true },
    });

    return { message: 'Email verified successfully.' };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.usersService.user({ email });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('User email not verified.');
    }

    return this.generateTokens(user.id, user.email, user.role);
  }

  async refresh(refreshDto: RefreshDto) {
    const { refreshToken } = refreshDto;

    const lookupHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: lookupHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.isRevoked || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    return this.generateTokens(tokenRecord.user.id, tokenRecord.user.email, tokenRecord.user.role);
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(payload);

    const refreshTokenStr = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');

    const expiresInDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      data: {
        accessToken,
        refreshToken: refreshTokenStr,
        user: {
          id: userId,
          email,
          role,
        },
      },
      message: 'Login successful.',
    };
  }
}
