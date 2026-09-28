"use client";

import { useEffect, useState } from "react";
import type { Palette } from "@/lib/tokens";
import type { Collaborator } from "@/lib/collaboration";
import { t, useLang } from "@/lib/i18n";

type Props = {
  p: Palette;
  open: boolean;
  roomId: string | null;
  users: Collaborator[];
  configured: boolean;
  link: string | null;
  onClose: () => void;
  onCreate: () => void;
  onCopy: () => void;
  onLeave: () => void;
};

export function CollaborationDialog({
  p,
  open,
  roomId,
  users,
  configured,
  link,
  onClose,
  onCreate,
  onCopy,
  onLeave,
}: Props) {
  const [copied, setCopied] = useState(false);
  const lang = useLang();

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("collaborate", lang)}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 650,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "rgba(0,0,0,0.32)",
      }}
    >
      <section
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100%, 520px)",
          padding: 24,
          borderRadius: 28,
          background: p.surfaceContainerHigh,
          color: p.onSurface,
          boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: p.primaryContainer, color: p.onPrimaryContainer, display: "grid", placeItems: "center", fontSize: 22 }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{t("collaborate", lang)}</div>
            <div style={{ fontSize: 13, color: p.onSurfaceVariant }}>{t("collabSubtitle", lang)}</div>
          </div>
          <button onClick={onClose} aria-label={t("close", lang)} style={{ border: 0, background: "transparent", color: p.onSurfaceVariant, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {!configured ? (
          <div style={{ padding: 16, borderRadius: 18, background: p.errorContainer, color: p.onErrorContainer, fontSize: 13, lineHeight: 1.55 }}>
            {t("collabNotConfigured", lang)}
          </div>
        ) : !roomId ? (
          <>
            <p style={{ margin: 0, color: p.onSurfaceVariant, fontSize: 14, lineHeight: 1.55 }}>
              {t("collabIntro", lang)}
            </p>
            <button onClick={onCreate} className="m3-press" style={{ height: 48, border: 0, borderRadius: 24, background: p.primary, color: p.onPrimary, fontWeight: 700, cursor: "pointer" }}>
              {t("collabCreate", lang)}
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {users.map((user) => (
                <span key={user.key} title={user.name} style={{ width: 32, height: 32, borderRadius: 16, background: user.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800 }}>
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
              ))}
              <span style={{ fontSize: 13, color: p.onSurfaceVariant }}>{t("collabOnline", lang).replace("{n}", String(users.length))}</span>
            </div>
            <div style={{ padding: 14, borderRadius: 16, background: p.surfaceContainerLow, fontSize: 12, lineHeight: 1.5, wordBreak: "break-all" }}>
              {link}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { onCopy(); setCopied(true); }} className="m3-press" style={{ flex: 1, height: 44, border: 0, borderRadius: 22, background: p.primary, color: p.onPrimary, fontWeight: 700, cursor: "pointer" }}>
                {copied ? t("copied", lang) : t("collabCopyLink", lang)}
              </button>
              <button onClick={onLeave} className="m3-press" style={{ height: 44, padding: "0 18px", border: 0, borderRadius: 22, background: p.secondaryContainer, color: p.onSecondaryContainer, fontWeight: 700, cursor: "pointer" }}>
                {t("collabLeave", lang)}
              </button>
            </div>
          </>
        )}

        <div style={{ fontSize: 12, color: p.onSurfaceVariant, lineHeight: 1.5 }}>
          {t("collabTip", lang)}
        </div>
      </section>
    </div>
  );
}
