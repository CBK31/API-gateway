import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class JwtPayloadRoleDto {
  @IsInt()
  @Min(1)
  id: number;

  @IsOptional()
  @IsString()
  name?: string;
}

export class JwtPayloadDto {
  @IsInt()
  @Min(1)
  id: number;

  @IsEmail()
  email: string;

  @ValidateNested()
  @Type(() => JwtPayloadRoleDto)
  role: JwtPayloadRoleDto;

  @IsInt()
  @Min(1)
  sessionId: number;

  @IsOptional()
  @IsInt()
  organization?: number | null;

  @IsOptional()
  @IsInt()
  partnershipId?: number | null;

  @IsInt()
  iat: number;

  @IsInt()
  exp: number;
}
