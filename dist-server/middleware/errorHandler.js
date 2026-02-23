import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';
export function errorHandler(error, req, res, _next) {
    logger.error('Request error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
    });
    // Zod validation errors
    if (error instanceof ZodError) {
        return res.status(400).json({
            error: 'Validation failed',
            details: error.issues,
        });
    }
    // Generic error
    res.status(500).json({
        error: error.message || 'Internal server error',
    });
}
