import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt.guard';

@Module({
  imports: [JwtModule.register({})],
  providers: [
    JwtGuard,
    { provide: APP_GUARD, useClass: JwtGuard },
  ],
  exports: [JwtModule, JwtGuard],
})
export class AuthModule {}
