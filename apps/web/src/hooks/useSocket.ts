import { useEffect, useState } from 'react';
import { insforge } from '../api/insforge';

/**
 * useSocket hook now uses InsForge Realtime SDK.
 * It provides a thin wrapper around the SDK to maintain compatibility
 * with existing .on / .off usage where possible.
 */
export function useSocket() {
  const [isConnected, setIsConnected] = useState(insforge.realtime.isConnected);

  useEffect(() => {
    // Ensure we are connected
    if (insforge.realtime.connectionState === 'disconnected') {
      insforge.realtime.connect().catch(console.error);
    }

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    insforge.realtime.on('connect', onConnect);
    insforge.realtime.on('disconnect', onDisconnect);

    return () => {
      insforge.realtime.off('connect', onConnect);
      insforge.realtime.off('disconnect', onDisconnect);
    };
  }, []);

  return insforge.realtime;
}

