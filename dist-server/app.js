"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./middleware/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const providers_1 = __importDefault(require("./routes/providers"));
const gateway_1 = __importDefault(require("./routes/gateway"));
const settings_1 = __importDefault(require("./routes/settings"));
const files_1 = __importDefault(require("./routes/files"));
const clawhub_1 = __importDefault(require("./routes/clawhub"));
const app = (0, express_1.default)();
exports.app = app;
// Security
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:2003',
        'http://127.0.0.1:2003',
        'http://127.0.0.1:5173',
        'http://localhost:5173', // Vite dev server
        'http://localhost:5174', // Vite dev server
        'http://127.0.0.1:5174',
        '*'
    ],
    credentials: true,
}));
// Body parsing
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Request logging
app.use(logger_1.requestLogger);
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
// API routes
app.use('/api/providers', providers_1.default);
app.use('/api/gateway', gateway_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/files', files_1.default);
app.use('/api/clawhub', clawhub_1.default);
// Serve static files
app.use(express_1.default.static('dist'));
// SPA fallback - use middleware instead of route
app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
        res.sendFile(path_1.default.join(process.cwd(), 'dist', 'index.html'));
    }
    else {
        next();
    }
});
// Error handler (must be last)
app.use(errorHandler_1.errorHandler);
