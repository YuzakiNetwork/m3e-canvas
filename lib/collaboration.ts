import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { Doc } from "./tokens";

export type Collaborator = {
  key: string;
  name: string;
  color: string;
};

type PresencePayload = {
  name?: unknown;
  color?: unknown;
};

const ROOM_PARAM = "room";
const EVENT_DOC = "doc";
const EVENT_SYNC = "sync-request";

const getEnv = () => {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
};

export const isCollaborationConfigured = () => !!getEnv();

export const createRoomId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

export const roomFromHash = (hash: string): string | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const room = params.get(ROOM_PARAM);
  return room && /^[a-zA-Z0-9_-]{16,128}$/.test(room) ? room : null;
};

export const collaborationLink = (shareUrl: string, roomId: string) =>
  shareUrl.includes("#") ? `${shareUrl}&${ROOM_PARAM}=${encodeURIComponent(roomId)}` : `${shareUrl}#${ROOM_PARAM}=${encodeURIComponent(roomId)}`;

const randomColor = () => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue} 72% 52%)`;
};

const readIdentity = () => {
  const fallback = {
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    name: "Guest",
    color: randomColor(),
  };
  try {
    const raw = sessionStorage.getItem("m3e:collab:identity");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.key && parsed?.name && parsed?.color) return parsed as typeof fallback;
    }
    sessionStorage.setItem("m3e:collab:identity", JSON.stringify(fallback));
  } catch {}
  return fallback;
};

const presenceUsers = (channel: RealtimeChannel): Collaborator[] => {
  const state = channel.presenceState() as Record<string, PresencePayload[]>;
  const users: Collaborator[] = [];
  for (const [key, entries] of Object.entries(state)) {
    const entry = entries?.[0];
    if (!entry) continue;
    users.push({
      key,
      name: typeof entry.name === "string" ? entry.name : "Guest",
      color: typeof entry.color === "string" ? entry.color : "#777",
    });
  }
  return users;
};

export type CollaborationSession = {
  identity: Collaborator;
  sendDocument: (doc: Doc) => void;
  requestSync: () => void;
  updatePresence: (patch: Partial<Pick<Collaborator, "name" | "color">>) => void;
  close: () => Promise<void>;
};

export async function openCollaboration(
  roomId: string,
  initialDoc: Doc,
  callbacks: {
    onDocument: (doc: Doc) => void;
    onPresence: (users: Collaborator[]) => void;
    onStatus?: (status: "connecting" | "connected" | "error") => void;
  },
): Promise<CollaborationSession | null> {
  const env = getEnv();
  if (!env) return null;

  const supabase = createClient(env.url, env.key);
  const identity = readIdentity();
  const channel = supabase.channel(`m3e:room:${roomId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: identity.key },
    },
  });

  const emitPresence = () => callbacks.onPresence(presenceUsers(channel));

  channel
    .on("broadcast", { event: EVENT_DOC }, (message) => {
      const doc = message.payload?.doc;
      if (!doc || typeof doc !== "object") return;
      callbacks.onDocument(doc as Doc);
    })
    .on("broadcast", { event: EVENT_SYNC }, () => {
      void channel.send({
        type: "broadcast",
        event: EVENT_DOC,
        payload: { doc: initialDoc },
      });
    })
    .on("presence", { event: "sync" }, emitPresence)
    .on("presence", { event: "join" }, emitPresence)
    .on("presence", { event: "leave" }, emitPresence);

  callbacks.onStatus?.("connecting");

  await new Promise<void>((resolve) => {
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          name: identity.name,
          color: identity.color,
          online_at: new Date().toISOString(),
        });
        callbacks.onStatus?.("connected");
        emitPresence();
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        callbacks.onStatus?.("error");
        resolve();
      }
    });
  });

  const sendDocument = (doc: Doc) => {
    void channel.send({
      type: "broadcast",
      event: EVENT_DOC,
      payload: { doc },
    });
  };

  const requestSync = () => {
    void channel.send({
      type: "broadcast",
      event: EVENT_SYNC,
      payload: { from: identity.key },
    });
  };

  const updatePresence = (patch: Partial<Pick<Collaborator, "name" | "color">>) => {
    if (patch.name !== undefined) identity.name = patch.name;
    if (patch.color !== undefined) identity.color = patch.color;
    void channel.track({
      name: identity.name,
      color: identity.color,
      online_at: new Date().toISOString(),
    });
  };

  return {
    identity,
    sendDocument,
    requestSync,
    updatePresence,
    close: async () => {
      await channel.untrack();
      await supabase.removeChannel(channel);
    },
  };
}
