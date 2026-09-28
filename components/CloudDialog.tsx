"use client";

import { useCallback, useEffect, useState } from "react";
import type { Palette, Doc } from "@/lib/tokens";
import { dateHeadline, t, useLang } from "@/lib/i18n";
import { describeSupabaseError, isSupabaseConfigured } from "@/lib/supabase";
import {
  currentCloudUser,
  deleteCloudProject,
  listCloudProjects,
  loadCloudProject,
  saveCloudProject,
  signInCloud,
  signOutCloud,
  signUpCloud,
  watchCloudUser,
  type CloudProject,
  type CloudUser,
} from "@/lib/cloud";

type Props = {
  p: Palette;
  open: boolean;
  doc: Doc;
  /** the cloud project the canvas was last opened from or saved to, if any */
  linked: { id: string; name: string } | null;
  onClose: () => void;
  onLinked: (project: { id: string; name: string } | null) => void;
  /** hands a design opened from the cloud to the editor, which asks before replacing the canvas */
  onOpenDoc: (doc: Doc, project: { id: string; name: string }) => void;
  onNotice: (message: string) => void;
};

export function CloudDialog({ p, open, doc, linked, onClose, onLinked, onOpenDoc, onNotice }: Props) {
  const lang = useLang();
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<CloudUser | null | undefined>(undefined);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [projects, setProjects] = useState<CloudProject[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fail = (e: unknown) => setError(describeSupabaseError(e));

  const refresh = useCallback(async () => {
    try {
      setProjects(await listCloudProjects());
    } catch (e) {
      setError(describeSupabaseError(e));
      setProjects([]);
    }
  }, []);

  /* who is signed in, kept current while the dialog is open */
  useEffect(() => {
    if (!open || !configured) return;
    let active = true;
    setError(null);
    setInfo(null);
    setDeleting(null);
    currentCloudUser().then((u) => active && setUser(u), (e) => { if (active) { setUser(null); setError(describeSupabaseError(e)); } });
    const stop = watchCloudUser((u) => active && setUser(u));
    return () => {
      active = false;
      stop();
    };
  }, [open, configured]);

  useEffect(() => {
    if (!open || !user) {
      setProjects(null);
      return;
    }
    void refresh();
  }, [open, user, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await job();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (mode === "up") {
        const { confirm } = await signUpCloud(email, password);
        if (confirm) {
          setInfo(t("cloudCheckEmail", lang));
          setMode("in");
        }
      } else {
        await signInCloud(email, password);
      }
      setPassword("");
    });

  const save = (asNew: boolean) =>
    run(async () => {
      const name = doc.title?.trim() || linked?.name || "Untitled";
      const saved = await saveCloudProject(doc, name, asNew ? null : linked?.id);
      onLinked({ id: saved.id, name: saved.name });
      onNotice(t("cloudSaved", lang));
      await refresh();
    });

  const openProject = (project: CloudProject) =>
    run(async () => {
      const { doc: next, name } = await loadCloudProject(project.id);
      onOpenDoc(next, { id: project.id, name });
      onClose();
    });

  const remove = (project: CloudProject) => {
    if (deleting !== project.id) {
      setDeleting(project.id);
      return;
    }
    setDeleting(null);
    void run(async () => {
      await deleteCloudProject(project.id);
      if (linked?.id === project.id) onLinked(null);
      await refresh();
    });
  };

  const input: React.CSSProperties = {
    height: 48,
    padding: "0 16px",
    borderRadius: 14,
    border: `1px solid ${p.outline}`,
    background: p.surfaceContainerLow,
    color: p.onSurface,
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };
  const filled: React.CSSProperties = { height: 44, padding: "0 20px", border: 0, borderRadius: 22, background: p.primary, color: p.onPrimary, fontWeight: 700, cursor: busy ? "progress" : "pointer", opacity: busy ? 0.7 : 1 };
  const tonal: React.CSSProperties = { ...filled, background: p.secondaryContainer, color: p.onSecondaryContainer };
  const text: React.CSSProperties = { border: 0, background: "transparent", color: p.primary, fontWeight: 700, cursor: "pointer", padding: 4, fontSize: 13 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("cloud", lang)}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 650, display: "grid", placeItems: "center", padding: 24, background: "rgba(0,0,0,0.32)" }}
    >
      <section
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(100%, 520px)", maxHeight: "min(100%, 680px)", overflowY: "auto", padding: 24, borderRadius: 28, background: p.surfaceContainerHigh, color: p.onSurface, boxShadow: "0 12px 40px rgba(0,0,0,0.22)", display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: p.primaryContainer, color: p.onPrimaryContainer, display: "grid", placeItems: "center", fontSize: 22 }}>☁</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{t("cloud", lang)}</div>
            <div style={{ fontSize: 13, color: p.onSurfaceVariant }}>{t("cloudHint", lang)}</div>
          </div>
          <button onClick={onClose} aria-label={t("close", lang)} style={{ border: 0, background: "transparent", color: p.onSurfaceVariant, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {!configured ? (
          <div style={{ padding: 16, borderRadius: 18, background: p.errorContainer, color: p.onErrorContainer, fontSize: 13, lineHeight: 1.55 }}>{t("cloudNotConfigured", lang)}</div>
        ) : user === undefined ? (
          <div style={{ fontSize: 14, color: p.onSurfaceVariant }}>{t("cloudLoading", lang)}</div>
        ) : !user ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: p.onSurfaceVariant }}>{t("cloudSignInTitle", lang)}</p>
            <input style={input} type="email" autoComplete="email" placeholder={t("cloudEmail", lang)} value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              style={input}
              type="password"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              placeholder={t("cloudPassword", lang)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && email && password && !busy) void submit(); }}
            />
            <button style={filled} disabled={busy || !email || !password} onClick={() => void submit()}>
              {mode === "up" ? t("cloudSignUp", lang) : t("cloudSignIn", lang)}
            </button>
            <button style={text} onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); setInfo(null); }}>
              {mode === "in" ? t("cloudToSignUp", lang) : t("cloudToSignIn", lang)}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, fontSize: 13, color: p.onSurfaceVariant, wordBreak: "break-all" }}>{t("cloudSignedInAs", lang).replace("{email}", user.email)}</span>
              <button style={text} onClick={() => void run(async () => { await signOutCloud(); onLinked(null); })}>{t("cloudSignOut", lang)}</button>
            </div>

            {linked && <div style={{ fontSize: 12, color: p.onSurfaceVariant }}>{t("cloudLinked", lang).replace("{name}", linked.name)}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={{ ...filled, flex: 1 }} disabled={busy} onClick={() => void save(false)}>{t("cloudSave", lang)}</button>
              {linked && <button style={tonal} disabled={busy} onClick={() => void save(true)}>{t("cloudSaveNew", lang)}</button>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {projects === null ? (
                <div style={{ fontSize: 14, color: p.onSurfaceVariant }}>{t("cloudLoading", lang)}</div>
              ) : projects.length === 0 ? (
                <div style={{ fontSize: 14, color: p.onSurfaceVariant }}>{t("cloudEmpty", lang)}</div>
              ) : (
                projects.map((project) => (
                  <div key={project.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 16, background: linked?.id === project.id ? p.secondaryContainer : p.surfaceContainerLow, color: linked?.id === project.id ? p.onSecondaryContainer : p.onSurface }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{t("cloudUpdated", lang).replace("{date}", dateHeadline(lang, new Date(project.updatedAt)))}</div>
                    </div>
                    <button style={text} disabled={busy} onClick={() => void openProject(project)}>{t("cloudOpen", lang)}</button>
                    <button style={{ ...text, color: deleting === project.id ? p.error : p.onSurfaceVariant }} disabled={busy} onClick={() => remove(project)}>
                      {deleting === project.id ? t("cloudDeleteConfirm", lang) : t("cloudDelete", lang)}
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {info && <div role="status" style={{ padding: 14, borderRadius: 16, background: p.primaryContainer, color: p.onPrimaryContainer, fontSize: 13, lineHeight: 1.5 }}>{info}</div>}
        {error && <div role="alert" style={{ padding: 14, borderRadius: 16, background: p.errorContainer, color: p.onErrorContainer, fontSize: 12, lineHeight: 1.5, wordBreak: "break-word" }}>{error}</div>}
      </section>
    </div>
  );
}
