import { SetMetadata } from '@nestjs/common';

/**
 * Opportunistic JWT validation:
 * - No Authorization header → request passes through anonymously.
 * - Valid Bearer token → payload is attached to req.user.
 * - Malformed / invalid token → 401 (we still reject abuse).
 *
 * Use on routes that may be called by both logged-in and anonymous users
 * (e.g., the proxy controller, since Wazoo's login endpoint itself is public).
 */
export const IS_SOFT_JWT_KEY = 'isSoftJwt';
export const SoftJwt = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_SOFT_JWT_KEY, true);
