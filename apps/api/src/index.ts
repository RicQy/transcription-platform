import './config/env';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import audioRouter from './routes/audio';
import webhooksRouter from './routes/webhooks';
import { initIo } from './sockets/index';
import { startAsrWorker } from './services/asrWorker';

const app: Express = express();
const httpServer: Server = createServer(app);

initIo(httpServer);

if (env.NODE_ENV !== 'test') {
  startAsrWorker();
}

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/audio', audioRouter);
app.use('/internal', webhooksRouter);

app.use(errorHandler);

if (env.NODE_ENV !== 'test') {
  httpServer.listen(env.PORT, () => {
    logger.info(`API server listening on port ${env.PORT}`);
  });
}

export { app, httpServer };
