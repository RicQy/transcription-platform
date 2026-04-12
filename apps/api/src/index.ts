import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { initSocket } from './lib/socket.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import audioRoutes from './routes/audio.routes.js';
import transcriptionRoutes from './routes/transcription.routes.js';
import styleGuideRoutes from './routes/style-guide.routes.js';
import speakerRoutes from './routes/speaker.routes.js';
import evaluationRoutes from './routes/evaluation.routes.js';
import './workers/transcription.worker.js';

dotenv.config();

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const PORT = Number(process.env.PORT) || 3002;

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for easier local dev if needed, or configure strictly
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

app.use(limiter);

// Static files
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/auth', authRoutes);
app.use('/', audioRoutes);
app.use('/', transcriptionRoutes);
app.use('/', styleGuideRoutes);
app.use('/', speakerRoutes);
app.use('/', evaluationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', source: 'local-node-api', time: new Date() });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
});

server.listen(PORT, () => {
  console.log(`Legal Transcribe Node API (Modular) running on http://localhost:${PORT}`);
});
