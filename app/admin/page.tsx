"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QCLCompact } from "@/components/QCLLogo";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "member" | "admin";
  mondayConfigured: boolean;
  googleConnected: boolean;
  createdAt: string;
}

const C = {
  bg: "#0d1117",
  bg2: "#161b22",
  bg3: "#1c2128",
  border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.14)",
  text: "#d8e3f5",
  muted: "rgba(216,227,245,0.45)",
  blue: "#4ba3ff",
  green: "#38ef7d",
  red: "#ff4d6a",
  amber: "#f59e0b",
  purple: "#9b7ff5",
};

const roleColors: Record<string, string> = {
  owner: C.purple,
  member: C.blue,
  admin: C.amber,
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function avatarBg(name: string) {
  const colors = ["#4ba3ff", "#9b7ff5", "#38ef7d", "#f59e0b", "#ff4d6a", "#06b6d4"];
  const i = name.charCodeAt(0) % colors.length;
  return colors[i];
}

export default function AdminPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<{ name: string; email: string } | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [tokenTarget, setTokenTarget] = useState<AdminUser | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "" });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [tokenValue, setTokenValue] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [deleting, setDeleting] = useState(false);

  // Import state
  const [importResult, setImportResult] = useState<{ ok?: boolean; stats?: Record<string, number>; error?: string } | null>(null);
  const [importing, setImporting] = useState(false);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user || d.user.role !== "admin") {
          router.push("/");
          return;
        }
        setAdminUser(d.user);
      });
    loadUsers();
  }, [loadUsers, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function handleCreate() {
    setCreateError("");
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setCreateError("All fields are required");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "" });
      loadUsers();
    } else {
      setCreateError(data.error || "Failed to create user");
    }
  }

  async function handleSaveToken() {
    if (!tokenTarget || !tokenValue.trim()) return;
    setTokenSaving(true);
    await fetch(`/api/admin/users/${tokenTarget.id}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mondayApiToken: tokenValue.trim() }),
    });
    setTokenSaving(false);
    setTokenSaved(true);
    setTimeout(() => {
      setTokenSaved(false);
      setTokenTarget(null);
      setTokenValue("");
      loadUsers();
    }, 1200);
  }

  async function handleResetPassword() {
    if (!passwordTarget || !newPassword.trim()) return;
    setPasswordSaving(true);
    await fetch(`/api/admin/users/${passwordTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword.trim() }),
    });
    setPasswordSaving(false);
    setPasswordSaved(true);
    setTimeout(() => {
      setPasswordSaved(false);
      setPasswordTarget(null);
      setNewPassword("");
    }, 1200);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    loadUsers();
  }

  const s: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif", color: C.text },
    header: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "20px 32px", borderBottom: `1px solid ${C.border}`,
      background: C.bg2,
    },
    logo: { display: "flex", alignItems: "center", gap: 12 },
    logoMark: {
      width: 36, height: 36, borderRadius: 9,
      background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 16, fontWeight: 700, color: "#fff",
    },
    logoText: { fontSize: 16, fontWeight: 700, letterSpacing: "-0.2px" },
    logoSub: { fontSize: 11, color: C.muted, marginTop: 1 },
    headerRight: { display: "flex", alignItems: "center", gap: 16 },
    userPill: {
      padding: "5px 12px", borderRadius: 20,
      background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
      fontSize: 12, color: C.amber,
    },
    signOut: {
      padding: "6px 14px", borderRadius: 7, background: "none",
      border: `1px solid ${C.border2}`, color: C.muted, fontSize: 13,
      cursor: "pointer",
    },
    main: { padding: "32px" },
    sectionHeader: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 20,
    },
    sectionTitle: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px" },
    sectionCount: { fontSize: 13, color: C.muted, marginLeft: 8, fontWeight: 400 },
    addBtn: {
      padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
      background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
      border: "none", color: "#fff",
    },
    card: { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" },
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: {
      padding: "12px 16px", textAlign: "left" as const,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.5px",
      textTransform: "uppercase" as const, color: C.muted,
      borderBottom: `1px solid ${C.border}`,
      background: C.bg3,
    },
    td: {
      padding: "14px 16px", fontSize: 13,
      borderBottom: `1px solid ${C.border}`,
      verticalAlign: "middle" as const,
    },
    overlay: {
      position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
    },
    modal: {
      background: C.bg3, border: `1px solid ${C.border2}`,
      borderRadius: 16, padding: "28px 28px", width: "100%", maxWidth: 420,
    },
    modalTitle: { fontSize: 16, fontWeight: 700, marginBottom: 20 },
    label: {
      display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px",
      textTransform: "uppercase" as const, color: C.muted, marginBottom: 6,
    },
    inp: {
      width: "100%", padding: "9px 12px",
      background: C.bg, border: `1px solid ${C.border}`,
      borderRadius: 8, color: C.text, fontSize: 13, outline: "none",
      boxSizing: "border-box" as const, marginBottom: 14,
    },
    row: { display: "flex", gap: 10, marginTop: 6 },
    cancelBtn: {
      flex: 1, padding: "9px", borderRadius: 8, cursor: "pointer", fontSize: 13,
      background: "none", border: `1px solid ${C.border2}`, color: C.muted,
    },
  };

  function confirmBtn(color: string): React.CSSProperties {
    return { flex: 1, padding: "9px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, background: `${color}22`, border: `1px solid ${color}44`, color };
  }
  function actionBtn(color: string): React.CSSProperties {
    return { padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, background: `${color}15`, border: `1px solid ${color}30`, color, marginRight: 6 };
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.logo}>
          <QCLCompact height={28} />
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>
            <div style={s.logoText}>Admin Panel</div>
            <div style={s.logoSub}>User Management</div>
          </div>
        </div>
        <div style={s.headerRight}>
          {adminUser && (
            <div style={s.userPill}>{adminUser.email}</div>
          )}
          <button style={s.signOut} onClick={logout}>Sign out</button>
        </div>
      </header>

      {/* Main */}
      <main style={s.main}>
        <div style={s.sectionHeader}>
          <div>
            <span style={s.sectionTitle}>Team Members</span>
            <span style={s.sectionCount}>{users.length} accounts</span>
          </div>
          <button style={s.addBtn} onClick={() => { setCreateForm({ name: "", email: "", password: "" }); setCreateError(""); setShowCreate(true); }}>
            + Add Member
          </button>
        </div>

        <div style={s.card}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: C.muted }}>Loading…</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Member</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Role</th>
                  <th style={s.th}>Monday</th>
                  <th style={s.th}>Google</th>
                  <th style={s.th}>Joined</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ background: "transparent" }}>
                    <td style={s.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: avatarBg(u.name),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
                        }}>
                          {initials(u.name)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ ...s.td, color: C.muted }}>{u.email}</td>
                    <td style={s.td}>
                      <span style={{
                        padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: `${roleColors[u.role] || C.muted}18`,
                        border: `1px solid ${roleColors[u.role] || C.muted}35`,
                        color: roleColors[u.role] || C.muted,
                        textTransform: "capitalize",
                      }}>{u.role}</span>
                    </td>
                    <td style={s.td}>
                      <span style={{ color: u.mondayConfigured ? C.green : C.muted, fontSize: 12 }}>
                        {u.mondayConfigured ? "✓ Set" : "— Not set"}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ color: u.googleConnected ? C.green : C.muted, fontSize: 12 }}>
                        {u.googleConnected ? "✓ Connected" : "— Not connected"}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: C.muted, fontSize: 12 }}>
                      {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td style={s.td}>
                      {u.role !== "admin" && (
                        <>
                          <button
                            style={actionBtn(C.blue)}
                            onClick={() => { setTokenTarget(u); setTokenValue(""); setTokenSaved(false); }}
                          >Set Token</button>
                          <button
                            style={actionBtn(C.amber)}
                            onClick={() => { setPasswordTarget(u); setNewPassword(""); setPasswordSaved(false); }}
                          >Reset PW</button>
                          {u.role !== "owner" && (
                            <button
                              style={actionBtn(C.red)}
                              onClick={() => setDeleteTarget(u)}
                            >Delete</button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Import Data */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 6 }}>
            Import Data
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
            Upload a <code style={{ background: C.bg3, padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>data-export.json</code> file generated from your local machine to copy all data to this server.
          </div>
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px 24px" }}>
            <label style={{
              display: "inline-block", padding: "9px 20px", borderRadius: 8, cursor: "pointer",
              background: "rgba(75,163,255,0.12)", border: "1px solid rgba(75,163,255,0.25)",
              color: C.blue, fontSize: 13, fontWeight: 500,
            }}>
              {importing ? "Importing…" : "Choose data-export.json"}
              <input
                type="file"
                accept=".json"
                style={{ display: "none" }}
                disabled={importing}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImporting(true);
                  setImportResult(null);
                  try {
                    const text = await file.text();
                    const json = JSON.parse(text);
                    const res = await fetch("/api/admin/import", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(json),
                    });
                    const data = await res.json();
                    setImportResult(data);
                    if (res.ok) loadUsers();
                  } catch {
                    setImportResult({ error: "Failed to read or upload file" });
                  }
                  setImporting(false);
                  e.target.value = "";
                }}
              />
            </label>
            {importResult && (
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 8,
                background: importResult.ok ? "rgba(56,239,125,0.08)" : "rgba(255,77,106,0.08)",
                border: `1px solid ${importResult.ok ? "rgba(56,239,125,0.25)" : "rgba(255,77,106,0.25)"}`,
                color: importResult.ok ? C.green : C.red, fontSize: 13,
              }}>
                {importResult.ok ? (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>✓ Import successful</div>
                    {importResult.stats && Object.entries(importResult.stats).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 12, color: C.text, opacity: 0.8 }}>
                        {k}: {v} rows
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>✗ {importResult.error}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create User Modal */}
      {showCreate && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Add Team Member</div>
            <label style={s.label}>Full Name</label>
            <input style={s.inp} type="text" placeholder="Jane Smith" value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
            <label style={s.label}>Email</label>
            <input style={s.inp} type="email" placeholder="jane@example.com" value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            <label style={s.label}>Password</label>
            <input style={s.inp} type="password" placeholder="Temporary password" value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
            {createError && (
              <div style={{ padding: "8px 12px", borderRadius: 7, background: "rgba(255,77,106,0.12)", border: "1px solid rgba(255,77,106,0.25)", color: C.red, fontSize: 13, marginBottom: 14 }}>
                {createError}
              </div>
            )}
            <div style={s.row}>
              <button style={s.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                style={{ ...confirmBtn(C.green), opacity: creating ? 0.6 : 1 }}
                onClick={handleCreate}
                disabled={creating}
              >{creating ? "Creating…" : "Create Account"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Set Monday Token Modal */}
      {tokenTarget && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setTokenTarget(null)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Set Monday Token — {tokenTarget.name}</div>
            <label style={s.label}>Monday API Token</label>
            <input style={s.inp} type="password" placeholder="Paste full token…" value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)} />
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
              This replaces the existing token for this user.
            </div>
            <div style={s.row}>
              <button style={s.cancelBtn} onClick={() => setTokenTarget(null)}>Cancel</button>
              <button
                style={{ ...confirmBtn(tokenSaved ? C.green : C.blue), opacity: tokenSaving ? 0.6 : 1 }}
                onClick={handleSaveToken}
                disabled={tokenSaving || !tokenValue.trim()}
              >{tokenSaved ? "Saved ✓" : tokenSaving ? "Saving…" : "Save Token"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {passwordTarget && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setPasswordTarget(null)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Reset Password — {passwordTarget.name}</div>
            <label style={s.label}>New Password</label>
            <input style={s.inp} type="password" placeholder="New password…" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} />
            <div style={s.row}>
              <button style={s.cancelBtn} onClick={() => setPasswordTarget(null)}>Cancel</button>
              <button
                style={{ ...confirmBtn(passwordSaved ? C.green : C.amber), opacity: passwordSaving ? 0.6 : 1 }}
                onClick={handleResetPassword}
                disabled={passwordSaving || !newPassword.trim()}
              >{passwordSaved ? "Updated ✓" : passwordSaving ? "Saving…" : "Reset Password"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Delete Account</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
              Are you sure you want to delete <strong style={{ color: C.text }}>{deleteTarget.name}</strong> ({deleteTarget.email})?
              This cannot be undone.
            </div>
            <div style={s.row}>
              <button style={s.cancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                style={{ ...confirmBtn(C.red), opacity: deleting ? 0.6 : 1 }}
                onClick={handleDelete}
                disabled={deleting}
              >{deleting ? "Deleting…" : "Delete Account"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
