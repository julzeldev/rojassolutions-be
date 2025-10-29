import { Injectable, CanActivate, Type } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const PreAuthGuardBase = AuthGuard('pre-auth') as unknown as Type<CanActivate>;

@Injectable()
export class PreAuthGuard extends (PreAuthGuardBase as any) {}
