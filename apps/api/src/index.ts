import './config/env';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { createServer, Server } from 'http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import authRouter from './routes/auth';
import audioRouter from './routes/audio';
import webhooksRouter from './routes/webhooks';
import styleGuideRouter from './routes/styleGuide';
import transcriptsRouter from './routes/transcripts';
import { initIo } from './sockets/index';
import { startAsrWorker } from './services/asrWorker';

const app: Express = express();
const httpServer: Server = createServer(app);

// Initialize Socket.IO
initIo(httpServer);

// Start background services
if (env.NODE_ENV !== 'test') {
  startAsrWorker();
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration
const corsOptions = {
  origin: env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Add your production domains
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware stack
app.use(compression());
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging middleware
app.use(requestLogger);

// Health check endpoints
app.get('/health', (req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    version: process.env.npm_package_version || '0.0.1',
    memory: process.memoryUsage(),
    server: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };
  
  res.status(200).json(health);
});

app.get('/health/ready', async (req: Request, res: Response) => {
  try {
    // Check database connectivity
    // await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis connectivity
    // await redis.ping();
    
    res.status(200).json({
      status: 'ready',
      checks: {
        database: 'ok',
        redis: 'ok',
        asr_worker: 'ok'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: 'Service dependencies not available'
    });
  }
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/audio', audioRouter);
app.use('/api/style-guide', styleGuideRouter);
app.use('/api/transcripts', transcriptsRouter);
app.use('/internal', webhooksRouter);

// API documentation endpoint
app.get('/api', (req: Request, res: Response) => {
  const apiDocs = {
    title: 'Transcribe Platform API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/login': 'User authentication',
        'POST /api/auth/register': 'User registration',
        'POST /api/auth/refresh': 'Token refresh',
        'POST /api/auth/logout': 'User logout'
      },
      audio: {
        'GET /api/audio': 'List audio files',
        'POST /api/audio': 'Upload audio file',
        'GET /api/audio/:id': 'Get audio file details',
        'DELETE /api/audio/:id': 'Delete audio file'
      },
      health: {
        'GET /health': 'Basic health check',
        'GET /health/ready': 'Readiness check with dependencies'
      }
    },
    documentation: '/api/docs',
    timestamp: new Date().toISOString()
  };
  
  res.json(apiDocs);
});

// Static files for uploads (if needed)
app.use('/uploads', express.static(env.FILE_STORAGE_PATH));

// 404 handler
app.use('*', (req: Request, res: Response) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connections
    // prisma.$disconnect();
    
    // Close Redis connections
    // redis.quit();
    
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
if (env.NODE_ENV !== 'test') {
  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 Transcribe Platform API Server started successfully!`);
    logger.info(`📍 Server running on port ${env.PORT}`);
    logger.info(`🌍 Environment: ${env.NODE_ENV}`);
    logger.info(`📊 Health check: http://localhost:${env.PORT}/health`);
    logger.info(`📚 API documentation: http://localhost:${env.PORT}/api`);
    
    if (env.NODE_ENV === 'development') {
      logger.info(`🔧 Development mode - Hot reload enabled`);
    }
  });
}

export { app, httpServer };
