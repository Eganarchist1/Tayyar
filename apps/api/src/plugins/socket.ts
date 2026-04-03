import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import websocket from "@fastify/websocket";

type BroadcastOptions = {
  channels?: string[];
};

type SubscriptionMessage = {
  type: "SUBSCRIBE" | "UNSUBSCRIBE" | "SUBSCRIBE_ORDERS";
  payload?: {
    channels?: string[];
    channel?: string;
  };
};

function normalizeChannels(message: SubscriptionMessage["payload"]) {
  const channels = new Set<string>(["global"]);

  if (message?.channel) {
    channels.add(message.channel);
  }

  for (const channel of message?.channels || []) {
    if (channel) {
      channels.add(channel);
    }
  }

  return Array.from(channels);
}

async function socketPlugin(server: FastifyInstance) {
  await server.register(websocket);

  const subscriptions = new Map<any, Set<string>>();

  const send = (socket: any, type: string, payload: unknown) => {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify({ type, payload }));
    }
  };

  server.get("/v1/ws", { websocket: true }, (connection, req) => {
    subscriptions.set(connection.socket, new Set(["global"]));
    server.log.info({ remoteAddress: req.socket.remoteAddress }, "WebSocket connection established");

    connection.socket.on("message", (message: string) => {
      try {
        const data = JSON.parse(message.toString()) as { type?: string; payload?: any };
        server.log.debug({ type: data.type }, "WebSocket message received");

        switch (data.type) {
          case "SUBSCRIBE": {
            const channels = normalizeChannels(data.payload);
            subscriptions.set(connection.socket, new Set(channels));
            send(connection.socket, "SUBSCRIBED", { channels });
            break;
          }
          case "UNSUBSCRIBE": {
            subscriptions.set(connection.socket, new Set(["global"]));
            send(connection.socket, "SUBSCRIBED", { channels: ["global"] });
            break;
          }
          case "SUBSCRIBE_ORDERS": {
            const current = subscriptions.get(connection.socket) || new Set<string>(["global"]);
            current.add("orders");
            subscriptions.set(connection.socket, current);
            send(connection.socket, "SUBSCRIBED", { channels: Array.from(current) });
            break;
          }
          case "HERO_PING":
            server.broadcast("LOCATION_UPDATE", data.payload, { channels: ["live-map"] });
            break;
          default:
            break;
        }
      } catch (err) {
        server.log.error({ err }, "WebSocket message handling failed");
      }
    });

    connection.socket.on("close", () => {
      subscriptions.delete(connection.socket);
      server.log.info("WebSocket connection closed");
    });
  });

  server.decorate("broadcast", (type: string, payload: any, options?: BroadcastOptions) => {
    const channels = options?.channels?.length ? options.channels : ["global"];

    subscriptions.forEach((clientChannels, socket) => {
      if (channels.some((channel) => clientChannels.has(channel))) {
        send(socket, type, payload);
      }
    });
  });
}

declare module "fastify" {
  interface FastifyInstance {
    broadcast(type: string, payload: any, options?: BroadcastOptions): void;
  }
}

export default fp(socketPlugin, {
  name: "socket-plugin",
});
