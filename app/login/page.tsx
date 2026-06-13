"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { QCLFull } from "@/components/QCLLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(data.user?.role === "admin" ? "/admin" : "/");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--qcl-bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "var(--qcl-bg3)",
        border: "1px solid var(--qcl-border)",
        borderRadius: 16,
        padding: "40px 36px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <QCLFull height={64} />
          <div style={{ color: "rgba(216,227,245,0.45)", fontSize: 13 }}>
            Sign in to your account
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "rgba(216,227,245,0.7)", fontSize: 12, fontWeight: 500, marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="qcl-inp"
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--qcl-bg)",
                border: "1px solid var(--qcl-border)",
                borderRadius: 8,
                color: "var(--qcl-text)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", color: "rgba(216,227,245,0.7)", fontSize: 12, fontWeight: 500, marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="qcl-inp"
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--qcl-bg)",
                border: "1px solid var(--qcl-border)",
                borderRadius: 8,
                color: "var(--qcl-text)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(255,77,106,0.12)",
              border: "1px solid rgba(255,77,106,0.25)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#ff4d6a",
              fontSize: 13,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="qcl-btn qcl-btn-primary"
            style={{
              width: "100%",
              padding: "11px",
              background: "linear-gradient(135deg, #4ba3ff 0%, #9b7ff5 100%)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
