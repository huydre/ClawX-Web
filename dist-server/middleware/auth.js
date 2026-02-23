"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const storage_1 = require("../services/storage");
const logger_1 = require("../utils/logger");
async function authMiddleware(req, res, next) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            logger_1.logger.warn('Auth failed: No token', { ip: req.ip, path: req.path });
            return res.status(401).json({ error: 'No token provided' });
        }
        const settings = await (0, storage_1.getSettings)();
        if (token !== settings.serverToken) {
            logger_1.logger.warn('Auth failed: Invalid token', { ip: req.ip, path: req.path });
            return res.status(401).json({ error: 'Invalid token' });
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}
