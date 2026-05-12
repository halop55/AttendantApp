import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";

type AuthInfo = {
  sub: string;
  email?: string;
  clientId?: string;
  organizationId?: string;
  scopes: string[];
  audience: string[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthInfo;
    }
  }
}

class AuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

function extractBearerToken(req: Request): string {
  const value = req.headers.authorization;

  if (!value) {
    throw new AuthorizationError("Authorization header is missing", 401);
  }

  if (!value.startsWith("Bearer ")) {
    throw new AuthorizationError(
      'Authorization header must start with "Bearer "',
      401
    );
  }

  return value.slice("Bearer ".length);
}

function parseAudience(aud: unknown): string[] {
  if (Array.isArray(aud)) return aud.filter((v): v is string => typeof v === "string");
  if (typeof aud === "string") return [aud];
  return [];
}

function parseScopes(payload: any): string[] {
  const scope = payload.scope;
  if (typeof scope !== "string") return [];
  return scope.split(" ").filter(Boolean);
}

function verifyPayload(payload: any, requiredScopes: string[]) {
  const audiences = parseAudience(payload.aud);
  const scopes = parseScopes(payload);

  if (!audiences.includes(env.LOGTO_AUDIENCE)) {
    throw new AuthorizationError("Invalid audience", 403);
  }

  if (!payload.sub) {
    throw new AuthorizationError("Invalid token subject", 401);
  }

  const missingScopes = requiredScopes.filter((scope) => !scopes.includes(scope));
  if (missingScopes.length > 0) {
    throw new AuthorizationError("Insufficient scope", 403);
  }
}

function toAuthInfo(payload: any): AuthInfo {
  const scopes = parseScopes(payload);
  const audience = parseAudience(payload.aud);
  const user = payload?.user;

  return {
    sub: payload.sub as string,
    email:
      user?.primaryEmail ||
      (typeof payload.email === "string" ? payload.email : undefined),
    clientId:
      typeof payload.client_id === "string" ? payload.client_id : undefined,
    organizationId:
      typeof payload.organization_id === "string"
        ? payload.organization_id
        : undefined,
    scopes,
    audience,
  };
}

function createDevAuth(): AuthInfo {
  return {
    sub: "dev-user-001",
    email: "test@company.com",
    clientId: "dev-client",
    organizationId: "dev-organization",
    scopes: ["attendance:read", "attendance:write"],
    audience: [env.LOGTO_AUDIENCE || "dev-api"],
  };
}

export function verifyAccessToken(requiredScopes: string[] | undefined = []) {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      if (process.env.BYPASS_AUTH === "true") {
        req.auth = createDevAuth();
        return next();
      }

      const token = extractBearerToken(req);

      const jose = await import("jose");
      const jwks = jose.createRemoteJWKSet(
        new URL(`${env.LOGTO_ENDPOINT}/oidc/jwks`)
      );

      const { payload } = await jose.jwtVerify(token, jwks, {
        issuer: `${env.LOGTO_ENDPOINT}/oidc`,
      });

      verifyPayload(payload, requiredScopes);
      req.auth = toAuthInfo(payload);

      return next();
    } catch (error) {
      const status = error instanceof AuthorizationError ? error.status : 401;
      const message = error instanceof Error ? error.message : "Unauthorized";

      return res.status(status).json({
        success: false,
        message,
      });
    }
  };
}