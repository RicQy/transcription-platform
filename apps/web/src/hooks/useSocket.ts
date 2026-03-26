import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@transcribe/shared-types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let sharedSocket: AppSocket | null = null;

function getSocket(): AppSocket | null {
  if (typeof window === 'undefined') return null;

  const socketUrl = import.meta.env.VITE_SOCKET_URL;
  if (!socketUrl) return null;

  if (!sharedSocket) {
    sharedSocket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    sharedSocket.on('connect', () => {
      console.log('Socket connected');
    });

    sharedSocket.on('connect_error', () => {
      console.log('Socket connection not available');
    });
  }
  return sharedSocket;
}

export function useSocket(): AppSocket | null {
  const socketRef = useRef<AppSocket | null>(getSocket());
  return socketRef.current;
}
