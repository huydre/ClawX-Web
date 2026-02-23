import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import providersRouter from './routes/providers';
import gatewayRouter from './routes/gateway';
import settingsRouter from './routes/settings';
import filesRouter from './routes/files';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:2003',
    'http://127.0.0.1:2003',
    'http://localhost:5173', // Vite dev server
    'http://127.0.0.1:5173'
  ],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API routes
app.use('/api/providers', providersRouter);
app.use('/api/gateway', gatewayRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/files', filesRouter);

// Serve static files
app.use(express.static('dist'));

// SPA fallback - use middleware instead of route
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  } else {
    next();
  }
});

// Error handler (must be last)
app.use(errorHandler);

export { app };
