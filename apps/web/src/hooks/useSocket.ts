import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildWebSocketUrl } from "@/lib/api";

type SocketMessage = {
  type: string;
  payload: unknown;
};

type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export function useSocket(channels: string[] = ["global"]) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<SocketMessage | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const unmountedRef = useRef(false);
  const [channelKey, setChannelKey] = useState("global");
  const subscribedChannels = useMemo(
    () => (channelKey ? channelKey.split("::").filter(Boolean) : ["global"]),
    [channelKey],
  );

  useEffect(() => {
    const nextKey = Array.from(new Set(["global", ...channels.filter(Boolean)])).sort().join("::");
    setChannelKey((current) => (current === nextKey ? current : nextKey));
  }, [channels]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;

    const connect = () => {
      setConnectionState(reconnectAttemptRef.current === 0 ? "connecting" : "reconnecting");
      const socket = new WebSocket(buildWebSocketUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        if (unmountedRef.current) {
          return;
        }

        clearReconnectTimer();
        reconnectAttemptRef.current = 0;
        setRetryCount(0);
        setLastError(null);
        setIsConnected(true);
        setConnectionState("connected");
        socket.send(JSON.stringify({ type: "SUBSCRIBE", payload: { channels: subscribedChannels } }));
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SocketMessage;
          setLastMessage(message);
        } catch {
          setLastError("SOCKET_PARSE_ERROR");
        }
      };

      socket.onerror = () => {
        setLastError("SOCKET_ERROR");
      };

      socket.onclose = () => {
        if (unmountedRef.current) {
          return;
        }

        setIsConnected(false);
        setConnectionState("reconnecting");
        reconnectAttemptRef.current += 1;
        setRetryCount(reconnectAttemptRef.current);

        const baseDelay = Math.min(10000, 1500 * 2 ** Math.min(reconnectAttemptRef.current - 1, 3));
        const jitter = Math.floor(Math.random() * 600);
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(connect, baseDelay + jitter);
      };
    };

    connect();

    return () => {
      unmountedRef.current = true;
      clearReconnectTimer();
      socketRef.current?.close();
    };
  }, [channelKey, clearReconnectTimer, subscribedChannels]);

  const sendMessage = useCallback((type: string, payload: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { isConnected, lastMessage, sendMessage, connectionState, retryCount, lastError };
}
