import { Injectable, CanActivate, Type } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// AuthGuard('local') returns a generated class; cast it to a Type that implements
// CanActivate so TypeScript and ESLint understand the exported class shape.
const LocalAuthGuardBase = AuthGuard('local') as unknown as Type<CanActivate>;

@Injectable()
export class LocalAuthGuard extends (LocalAuthGuardBase as any) {}
