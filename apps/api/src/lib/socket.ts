import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173'];

let io: Server;

export const initSocket = (server: http.Server) => {
  io = new Server(server, {
    cors: { origin: ALLOWED_ORIGINS, credentials: true }
  });
  return io;
};

export const getSocket = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocket(server) first.');
  }
  return io;
};

export { io };
