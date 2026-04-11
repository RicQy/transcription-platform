import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { initSocket } from './lib/socket.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import audioRoutes from './routes/audio.routes.js';
import transcriptionRoutes from './routes/transcription.routes.js';
import styleGuideRoutes from './routes/style-guide.routes.js';
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
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Static files
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/auth', authRoutes);
app.use('/', audioRoutes);
app.use('/', transcriptionRoutes);
app.use('/', styleGuideRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', source: 'local-node-api', time: new Date() });
});

server.listen(PORT, () => {
  console.log(`Legal Transcribe Node API (Modular) running on http://localhost:${PORT}`);
});
