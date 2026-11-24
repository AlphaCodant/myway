import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '../enums';

export interface AuthUser {
  id: string;
  phone: string;
  role: Role;
}

export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'public';

/** Restreint une route à certains rôles (l'admin passe partout). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** Route accessible sans connexion. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
