import { useEffect, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl } from '../api/config';

let socketInstance: Socket | null = null;

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  
  const socket = useMemo(() => {
    if (!socketInstance) {
      socketInstance = io(getApiBaseUrl(), {
        transports: ['websocket'],
      });
    }
    return socketInstance;
  }, []);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  return {
    socket,
    isConnected,
    on: (event: string, cb: Function) => socket.on(event, cb as any),
    off: (event: string, cb: Function) => socket.off(event, cb as any),
    emit: (event: string, ...args: any[]) => socket.emit(event, ...args),
    // Compatibility layer with previous InsForge realtime usage if any
    subscribe: (channel: string, event: string, cb: Function) => socket.on(`${channel}:${event}`, cb as any),
  };
}

