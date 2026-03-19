import type { Response, NextFunction } from 'express';
import { SiweMessage } from 'siwe';
import type { AuthenticatedRequest } from '../types';

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers['authorization'];
  if (!auth) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unsupported auth scheme' });
    return;
  }

  try {
    const token = auth.slice(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const siwe = new SiweMessage(decoded.message);
    const result = await siwe.verify({ signature: decoded.signature });
    if (!result.success) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
    req.agentAddress = result.data.address;
  } catch {
    res.status(401).json({ error: 'Invalid auth token' });
    return;
  }

  next();
}
