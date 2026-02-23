import { Request, Response, NextFunction } from 'express';
import { getSettings } from '../services/storage.js';
import { logger } from '../utils/logger.js';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn('Auth failed: No token', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'No token provided' });
    }

    const settings = await getSettings();

    if (token !== settings.serverToken) {
      logger.warn('Auth failed: Invalid token', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'Invalid token' });
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
