"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
function errorHandler(error, req, res, _next) {
    logger_1.logger.error('Request error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
    });
    // Zod validation errors
    if (error instanceof zod_1.ZodError) {
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
