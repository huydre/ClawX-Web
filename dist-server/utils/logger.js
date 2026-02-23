import winston from 'winston';
import path from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
const logDir = path.join(homedir(), '.clawx', 'logs');
// Ensure log directory exists
mkdirSync(logDir, { recursive: true });
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
        }),
    ],
});
