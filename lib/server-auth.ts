import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('WARNING: JWT_SECRET is not set. Set it in Render → Environment.');
}

const SECRET = JWT_SECRET || 'dev-only-insecure-secret-change-me';

export type OrgTokenPayload = {
  type: 'org';
  sub: string;
  email: string;
  orgId: string;
  role: string;
  sessionToken: string; // single-session enforcement
};

export type AdminTokenPayload = {
  type: 'admin';
  sub: string;
  email: string;
  role: string;
};

export type TokenPayload = OrgTokenPayload | AdminTokenPayload;

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function getAuthFromRequest(req: NextRequest): TokenPayload | null {
  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length);
  return verifyToken(token);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
