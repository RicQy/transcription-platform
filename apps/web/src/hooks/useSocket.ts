import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@transcribe/shared-types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let sharedSocket: AppSocket | null = null;

function getSocket(): AppSocket {
  if (!sharedSocket) {
    sharedSocket = io('/', { withCredentials: true, transports: ['websocket'] });
  }
  return sharedSocket;
}

export function useSocket(): AppSocket {
  const socketRef = useRef<AppSocket>(getSocket());
  return socketRef.current;
}
