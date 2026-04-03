import AsyncStorage from "@react-native-async-storage/async-storage";
import { heroFetch, isRetryableHeroError } from "@/lib/api";

const HERO_ACTION_QUEUE_KEY = "tayyar-hero-action-queue";

export type QueuedHeroAction = {
  id: string;
  kind: "HERO_STATUS" | "ORDER_STATUS" | "ORDER_ARRIVED";
  path: string;
  method: "PATCH" | "POST";
  body?: string;
  createdAt: string;
};

async function readQueue() {
  const raw = await AsyncStorage.getItem(HERO_ACTION_QUEUE_KEY);
  if (!raw) {
    return [] as QueuedHeroAction[];
  }

  try {
    return JSON.parse(raw) as QueuedHeroAction[];
  } catch {
    return [] as QueuedHeroAction[];
  }
}

async function writeQueue(queue: QueuedHeroAction[]) {
  await AsyncStorage.setItem(HERO_ACTION_QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueuedHeroActions() {
  return readQueue();
}

export async function getQueuedHeroActionCount() {
  const queue = await readQueue();
  return queue.length;
}

export async function enqueueHeroAction(
  action: Omit<QueuedHeroAction, "id" | "createdAt">,
) {
  const queue = await readQueue();
  const nextItem: QueuedHeroAction = {
    ...action,
    id: `${action.kind}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  queue.push(nextItem);
  await writeQueue(queue);
  return nextItem;
}

export async function flushQueuedHeroActions(token?: string | null) {
  const queue = await readQueue();
  if (!queue.length) {
    return { processed: 0, dropped: 0, remaining: 0 };
  }

  const remaining: QueuedHeroAction[] = [...queue];
  let processed = 0;
  let dropped = 0;

  while (remaining.length) {
    const current = remaining[0];

    try {
      await heroFetch(current.path, {
        method: current.method,
        body: current.body,
      }, token);
      remaining.shift();
      processed += 1;
    } catch (error) {
      if (isRetryableHeroError(error)) {
        break;
      }

      remaining.shift();
      dropped += 1;
    }
  }

  await writeQueue(remaining);
  return {
    processed,
    dropped,
    remaining: remaining.length,
  };
}
