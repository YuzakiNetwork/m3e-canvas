import type { User } from "@supabase/supabase-js";
import { deserializeProject, PROJECT_FORMAT, PROJECT_VERSION } from "./project";
import { getSupabase } from "./supabase";
import type { Doc } from "./tokens";

/* Cloud save: an email/password account (Supabase Auth) and one row per project in
 * public.cloud_projects, readable and writable only by its owner (see supabase/schema.sql).
 * The row's `data` is the same versioned envelope a .m3e file holds, so it goes through
 * the same validation on the way back in. Collaboration signs in anonymously through the
 * same client; an anonymous session is not an account, so it counts as signed out here. */

export type CloudUser = { id: string; email: string };
export type CloudProject = { id: string; name: string; updatedAt: string };

const client = () => {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
};

const asCloudUser = (user: User | null | undefined): CloudUser | null =>
  user && !user.is_anonymous && user.email ? { id: user.id, email: user.email } : null;

export async function currentCloudUser(): Promise<CloudUser | null> {
  const { data, error } = await client().auth.getSession();
  if (error) throw error;
  return asCloudUser(data.session?.user);
}

/** calls back whenever the account signs in or out; returns the unsubscribe */
export function watchCloudUser(callback: (user: CloudUser | null) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(asCloudUser(session?.user)));
  return () => data.subscription.unsubscribe();
}

/** `confirm` is true when Supabase wants the emailed link clicked before the first sign-in */
export async function signUpCloud(email: string, password: string): Promise<{ confirm: boolean }> {
  const { data, error } = await client().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin + window.location.pathname },
  });
  if (error) throw error;
  return { confirm: !data.session };
}

export async function signInCloud(email: string, password: string): Promise<void> {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signOutCloud(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

type Row = { id: string; name: string; updated_at: string };
const toProject = (row: Row): CloudProject => ({ id: row.id, name: row.name, updatedAt: row.updated_at });

export async function listCloudProjects(): Promise<CloudProject[]> {
  const { data, error } = await client().from("cloud_projects").select("id,name,updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toProject);
}

const envelope = (doc: Doc) => ({ format: PROJECT_FORMAT, version: PROJECT_VERSION, document: doc });

/** overwrites `id` when given, otherwise stores the design as a new project */
export async function saveCloudProject(doc: Doc, name: string, id?: string | null): Promise<CloudProject> {
  const supabase = client();
  const title = name.trim() || "Untitled";
  // JSON round trip drops `undefined` fields the same way a saved file would
  const data = JSON.parse(JSON.stringify(envelope(doc)));
  const query = id
    ? supabase.from("cloud_projects").update({ name: title, data }).eq("id", id)
    : supabase.from("cloud_projects").insert({ name: title, data });
  const { data: row, error } = await query.select("id,name,updated_at").single();
  if (error) throw error;
  return toProject(row as Row);
}

export async function loadCloudProject(id: string): Promise<{ doc: Doc; name: string }> {
  const { data, error } = await client().from("cloud_projects").select("name,data").eq("id", id).single();
  if (error) throw error;
  const doc = deserializeProject((data as { data: unknown }).data);
  if (!doc) throw new Error("This cloud project is not a valid M3E Canvas design.");
  return { doc, name: (data as { name: string }).name };
}

export async function deleteCloudProject(id: string): Promise<void> {
  const { error } = await client().from("cloud_projects").delete().eq("id", id);
  if (error) throw error;
}
