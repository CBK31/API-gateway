import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Request } from 'express';
import { AllConfigType } from '../../config/config.type';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayloadDto } from '../dto/jwt-payload.dto';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header not found');
    }

    const token = this.extractTokenFromHeader(authHeader);

    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(
        token,
        {
          secret: this.configService.getOrThrow('auth.secret', { infer: true }),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const dto = plainToInstance(JwtPayloadDto, payload);
    const errors = await validate(dto, { whitelist: false });
    if (errors.length > 0) {
      throw new UnauthorizedException('Invalid token payload');
    }

    (req as Request & { user: JwtPayloadDto }).user = dto;
    return true;
  }

  private extractTokenFromHeader(authHeader: string): string {
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Malformed Authorization header');
    }
    return token;
  }
}
