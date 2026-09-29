import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { describeSupabaseError, getSupabase, isSupabaseConfigured } from "./supabase";
import type { Doc } from "./tokens";

export type Collaborator = {
  key: string;
  name: string;
  color: string;
};

type PresencePayload = { name?: unknown; color?: unknown };

const ROOM_PARAM = "room";
const EVENT_DOC = "doc";
const EVENT_SYNC = "sync-request";
/** waits between attempts to join a channel while Realtime is still creating today's partition */
const JOIN_RETRY_DELAYS = [1500, 3000, 5000, 8000];

export const isCollaborationConfigured = isSupabaseConfigured;

/** what to show a person when joining or creating a room fails */
export const collaborationErrorMessage = describeSupabaseError;

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
  shareUrl.includes("#")
    ? `${shareUrl}&${ROOM_PARAM}=${encodeURIComponent(roomId)}`
    : `${shareUrl}#${ROOM_PARAM}=${encodeURIComponent(roomId)}`;

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

const ensureAuthenticated = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;

  const { data: anonymous, error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError || !anonymous.session) {
    throw signInError ?? new Error("Anonymous authentication is not enabled.");
  }
  return anonymous.session;
};

const joinRoom = async (supabase: SupabaseClient, roomId: string, userId: string, role = "editor") => {
  const { error } = await supabase
    .from("collab_room_members")
    .upsert(
      { room_id: roomId, user_id: userId, role },
      { onConflict: "room_id,user_id", ignoreDuplicates: true },
    );
  if (error) throw error;
};

export async function createCollaborationRoom(): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const session = await ensureAuthenticated(supabase);
  const roomId = createRoomId();

  const { error } = await supabase.from("collab_rooms").insert({
    id: roomId,
    owner_id: session.user.id,
  });
  if (error) throw error;

  try {
    await joinRoom(supabase, roomId, session.user.id, "owner");
  } catch (error) {
    await supabase.from("collab_rooms").delete().eq("id", roomId);
    throw error;
  }

  return roomId;
}

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
  getDocument: () => Doc,
  callbacks: {
    onDocument: (doc: Doc) => void;
    onPresence: (users: Collaborator[]) => void;
    onStatus?: (status: "connecting" | "connected" | "error") => void;
  },
): Promise<CollaborationSession | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const identity = readIdentity();

  try {
    const session = await ensureAuthenticated(supabase);
    await joinRoom(supabase, roomId, session.user.id);
  } catch (error) {
    callbacks.onStatus?.("error");
    throw error;
  }

  /* Realtime keeps realtime.messages partitioned by day and only creates a day's partition
   * once a client has connected. A private channel checks its policies against that table
   * as it joins, so the very first join of a day (or of a fresh project) can be refused with
   * MissingPartition while the partition is still being made. A moment later it exists, so
   * that one failure is worth retrying; anything else is reported straight away. */
  const build = () => {
    const next = supabase.channel(`m3e:room:${roomId}`, {
      config: {
        private: true,
        broadcast: { self: false },
        presence: { key: identity.key },
      },
    });
    next
      .on("broadcast", { event: EVENT_DOC }, (message) => {
        const doc = message.payload?.doc;
        if (!doc || typeof doc !== "object") return;
        callbacks.onDocument(doc as Doc);
      })
      .on("broadcast", { event: EVENT_SYNC }, () => {
        void next.send({
          type: "broadcast",
          event: EVENT_DOC,
          payload: { doc: getDocument() },
        });
      })
      .on("presence", { event: "sync" }, () => callbacks.onPresence(presenceUsers(next)))
      .on("presence", { event: "join" }, () => callbacks.onPresence(presenceUsers(next)))
      .on("presence", { event: "leave" }, () => callbacks.onPresence(presenceUsers(next)));
    return next;
  };

  const join = () =>
    new Promise<RealtimeChannel>((resolve, reject) => {
      const next = build();
      let settled = false;
      next.subscribe(async (status, error) => {
        if (status === "SUBSCRIBED") {
          await next.track({
            name: identity.name,
            color: identity.color,
            online_at: new Date().toISOString(),
          });
          settled = true;
          resolve(next);
        } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !settled) {
          /* only a join that never completed is torn down here; a live channel that hiccups
             later is left to realtime-js's own reconnect */
          settled = true;
          void supabase.removeChannel(next);
          reject(error ?? new Error(`Realtime channel failed: ${status}`));
        }
      });
    });

  callbacks.onStatus?.("connecting");

  let channel: RealtimeChannel | null = null;
  for (let attempt = 0; ; attempt++) {
    try {
      channel = await join();
      break;
    } catch (error) {
      const text = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
      if (attempt >= JOIN_RETRY_DELAYS.length || !/partition/i.test(text)) {
        callbacks.onStatus?.("error");
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, JOIN_RETRY_DELAYS[attempt]));
    }
  }
  const live = channel;
  callbacks.onStatus?.("connected");
  callbacks.onPresence(presenceUsers(live));

  const sendDocument = (doc: Doc) => {
    void live.send({
      type: "broadcast",
      event: EVENT_DOC,
      payload: { doc },
    });
  };

  const requestSync = () => {
    void live.send({
      type: "broadcast",
      event: EVENT_SYNC,
      payload: { from: identity.key },
    });
  };

  const updatePresence = (patch: Partial<Pick<Collaborator, "name" | "color">>) => {
    if (patch.name !== undefined) identity.name = patch.name;
    if (patch.color !== undefined) identity.color = patch.color;
    void live.track({
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
      await live.untrack();
      await supabase.removeChannel(live);
    },
  };
}
