import type { NextFunction, Request, Response } from "express";
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTPayload,
} from "jose";
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

const logtoJwks = createRemoteJWKSet(new URL(`${env.LOGTO_ENDPOINT}/oidc/jwks`));
const firebaseJwks = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

function extractBearerToken(req: Request): string {
  const value = req.headers.authorization;

  if (!value) {
    throw new AuthorizationError("Authorization header is missing", 401);
  }

  if (!value.startsWith("Bearer ")) {
    throw new AuthorizationError(
      'Authorization header must start with "Bearer "',
      401,
    );
  }

  return value.slice("Bearer ".length);
}

function parseAudience(aud: JWTPayload["aud"]): string[] {
  if (Array.isArray(aud)) return aud;
  if (typeof aud === "string") return [aud];
  return [];
}

function parseScopes(payload: JWTPayload): string[] {
  const scope = payload.scope;
  if (typeof scope !== "string") return [];
  return scope.split(" ").filter(Boolean);
}

function verifyLogtoPayload(payload: JWTPayload, requiredScopes: string[]) {
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

function toAuthInfo(payload: JWTPayload): AuthInfo {
  const scopes = parseScopes(payload);
  const audience = parseAudience(payload.aud);
  const user: any = payload?.user;

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

function toFirebaseAuthInfo(payload: JWTPayload): AuthInfo {
  const firebaseInfo = payload.firebase as
    | { sign_in_provider?: unknown }
    | undefined;

  return {
    sub: payload.sub as string,
    email: typeof payload.email === "string" ? payload.email : undefined,
    clientId:
      typeof firebaseInfo?.sign_in_provider === "string"
        ? firebaseInfo.sign_in_provider
        : "firebase",
    organizationId: undefined,
    scopes: ["attendance:read", "attendance:write"],
    audience: parseAudience(payload.aud),
  };
}

async function verifyFirebaseToken(token: string) {
  const { payload } = await jwtVerify(token, firebaseJwks, {
    audience: env.FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
  });

  if (!payload.sub) {
    throw new AuthorizationError("Invalid Firebase token subject", 401);
  }

  if (typeof payload.email !== "string" || payload.email.trim().length === 0) {
    throw new AuthorizationError("Firebase token email is missing", 401);
  }

  return toFirebaseAuthInfo(payload);
}

async function verifyLogtoToken(token: string, requiredScopes: string[]) {
  const { payload } = await jwtVerify(token, logtoJwks, {
    issuer: `${env.LOGTO_ENDPOINT}/oidc`,
  });

  verifyLogtoPayload(payload, requiredScopes);
  return toAuthInfo(payload);
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
      // Dev mode: allow local frontend and Supabase testing without tokens.
      if (process.env.BYPASS_AUTH === "true" && !req.headers.authorization) {
        req.auth = createDevAuth();
        return next();
      }

      const token = extractBearerToken(req);
      const decodedPayload = decodeJwt(token);
      const issuer = typeof decodedPayload.iss === "string" ? decodedPayload.iss : "";

      req.auth = issuer.startsWith("https://securetoken.google.com/")
        ? await verifyFirebaseToken(token)
        : await verifyLogtoToken(token, requiredScopes);

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
