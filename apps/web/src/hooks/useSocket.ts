import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@transcribe/shared-types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let sharedSocket: AppSocket | null = null;

function getSocket(): AppSocket | null {
  if (typeof window === 'undefined') return null;
  if (!sharedSocket) {
    sharedSocket = io('/', { withCredentials: true, transports: ['websocket'] });
  }
  return sharedSocket;
}

export function useSocket(): AppSocket | null {
  const socketRef = useRef<AppSocket | null>(getSocket());
  return socketRef.current;
}
