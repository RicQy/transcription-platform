import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';

let _io: SocketIOServer | null = null;

export function initIo(httpServer: HttpServer): SocketIOServer {
  _io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      credentials: true,
    },
  });

  _io.on('connection', (socket) => {
    logger.info('WebSocket client connected', { id: socket.id });
    socket.on('disconnect', () => {
      logger.info('WebSocket client disconnected', { id: socket.id });
    });
  });

  return _io;
}

export function getIo(): SocketIOServer {
  if (!_io) {
    throw new Error('Socket.io not initialized. Call initIo() first.');
  }
  return _io;
}
