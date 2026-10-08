import React, { useState, useEffect } from "react";
import {
  KeySquare, Webhook, Plus, Trash2, Copy, Check,
  CheckCircle2, AlertTriangle, RefreshCw, X
} from "lucide-react";
import api from "../services/api";

/* ─── API Keys pane ──────────────────────────────────────── */
function ApiKeyPane() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyData, setNewKeyData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function loadKeys() {
    setLoading(true);
    try {
      const r = await api.apiKeys.list();
      if (r?.success) {
        const list = Array.isArray(r.data?.keys)
          ? r.data.keys
          : Array.isArray(r.data?.apiKeys)
          ? r.data.apiKeys
          : Array.isArray(r.data)
          ? r.data
          : [];
        setKeys(list);
      }
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { loadKeys(); }, []);

  async function handleCreate(e) {
    e.preventDefault(); if (!newKeyName.trim()) return;
    setCreating(true); setError(""); setNewKeyData(null);
    try {
      const r = await api.apiKeys.create({ name: newKeyName.trim(), scopes: ["verify"] });
      if (r?.success) { setNewKeyData(r.data); setNewKeyName(""); loadKeys(); }
      else setError(r?.error?.message || "Failed to create API key");
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  async function handleRevoke(id) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try { await api.apiKeys.revoke(id); loadKeys(); }
    catch (err) { alert(err.message); }
  }

  function copyKey(k) {
    navigator.clipboard.writeText(k); setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const safeKeys = Array.isArray(keys) ? keys : [];

  return (
    <div>
      {/* Create form */}
      <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input type="text" placeholder="Key name (e.g. Employer Portal)" value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)} style={{ flex: 1, minWidth: "200px" }} required />
        <button type="submit" className="action-btn primary text-xs" disabled={creating}>
          <Plus size={13} />{creating ? "Creating..." : "Create API Key"}
        </button>
      </form>
      {error && <div className="alert-banner danger" style={{ marginBottom: "0.75rem" }}><AlertTriangle size={13} /><span>{error}</span></div>}
      {newKeyData && (
        <div className="alert-banner success" style={{ marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <CheckCircle2 size={13} />
          <span>Key created — copy it now, it will not be shown again:</span>
          <code style={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>{newKeyData.rawKey || newKeyData.apiKey?.key || "—"}</code>
          <button className="icon-action-btn" onClick={() => copyKey(newKeyData.rawKey || newKeyData.apiKey?.key || "")}>
            {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          </button>
          <button className="icon-action-btn" onClick={() => setNewKeyData(null)}><X size={13} /></button>
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: "center", padding: "1rem" }}><RefreshCw size={18} className="pulse-dot" style={{ opacity: 0.4 }} /></div>
      ) : safeKeys.length === 0 ? (
        <div className="empty-state" style={{ padding: "1.5rem" }}><KeySquare size={28} style={{ opacity: 0.2, marginBottom: "0.5rem" }} /><p>No API keys yet.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Key Prefix</th><th>Scopes</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {safeKeys.map((k) => (
              <tr key={k._id || k.apiKeyId}>
                <td><strong>{k.name}</strong></td>
                <td className="code-snippet">{k.keyPrefix || (k.key || "").slice(0, 12) + "..."}****</td>
                <td>{(k.scopes || []).map((s) => <span key={s} className="badge-tag" style={{ marginRight: "2px" }}>{s}</span>)}</td>
                <td className="text-muted text-xs">{new Date(k.createdAt).toLocaleDateString()}</td>
                <td><button className="action-btn danger text-xs" style={{ padding: "3px 8px" }} onClick={() => handleRevoke(k._id || k.apiKeyId)}><Trash2 size={11} /> Revoke</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── Webhooks pane ──────────────────────────────────────── */
function WebhookPane() {
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState("credential.issued");
  const [error, setError] = useState("");

  const EVENT_OPTS = [
    "credential.issued", "credential.revoked", "verification.completed",
    "key.rotated", "key.compromised", "bulk.issued"
  ];

  async function loadHooks() {
    setLoading(true);
    try {
      const r = await api.webhooks.list();
      if (r?.success) {
        const list = Array.isArray(r.data?.webhooks)
          ? r.data.webhooks
          : Array.isArray(r.data)
          ? r.data
          : [];
        setHooks(list);
      }
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { loadHooks(); }, []);

  async function handleCreate(e) {
    e.preventDefault(); if (!newUrl.trim()) return;
    setCreating(true); setError("");
    try {
      const r = await api.webhooks.register({ url: newUrl.trim(), events: newEvents.split(",").map((s) => s.trim()) });
      if (r?.success) { setNewUrl(""); setNewEvents("credential.issued"); loadHooks(); }
      else setError(r?.error?.message || "Failed to register webhook");
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this webhook?")) return;
    try { await api.webhooks.delete(id); loadHooks(); }
    catch (err) { alert(err.message); }
  }

  const safeHooks = Array.isArray(hooks) ? hooks : [];

  return (
    <div>
      <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "end" }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: "0.75rem" }}>Endpoint URL</label>
          <input type="url" placeholder="https://your.server/webhook" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} required />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: "0.75rem" }}>Events (comma-separated)</label>
          <select className="select-input" value={newEvents} onChange={(e) => setNewEvents(e.target.value)}>
            {EVENT_OPTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
            <option value="credential.issued,credential.revoked">credential.issued + revoked</option>
            <option value="*">* (all events)</option>
          </select>
        </div>
        <button type="submit" className="action-btn primary text-xs" disabled={creating} style={{ alignSelf: "flex-end", height: "38px" }}>
          <Plus size={13} />{creating ? "Registering..." : "Register"}
        </button>
      </form>
      {error && <div className="alert-banner danger" style={{ marginBottom: "0.75rem" }}><AlertTriangle size={13} /><span>{error}</span></div>}
      {loading ? (
        <div style={{ textAlign: "center", padding: "1rem" }}><RefreshCw size={18} className="pulse-dot" style={{ opacity: 0.4 }} /></div>
      ) : safeHooks.length === 0 ? (
        <div className="empty-state" style={{ padding: "1.5rem" }}><Webhook size={28} style={{ opacity: 0.2, marginBottom: "0.5rem" }} /><p>No webhooks registered yet.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Endpoint URL</th><th>Events</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {safeHooks.map((h) => (
              <tr key={h._id || h.webhookId}>
                <td className="code-snippet" style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis" }}>{h.url}</td>
                <td>{(h.events || []).map((ev) => <span key={ev} className="badge-tag" style={{ marginRight: "2px", fontSize: "0.65rem" }}>{ev}</span>)}</td>
                <td><span className="badge-tag" style={{ background: h.active !== false ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)", color: h.active !== false ? "#10b981" : "var(--color-danger)" }}>{h.active !== false ? "ACTIVE" : "INACTIVE"}</span></td>
                <td className="text-muted text-xs">{new Date(h.createdAt).toLocaleDateString()}</td>
                <td><button className="action-btn danger text-xs" style={{ padding: "3px 8px" }} onClick={() => handleDelete(h._id || h.webhookId)}><Trash2 size={11} /> Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── combined section ───────────────────────────────────── */
export default function ApiKeysWebhooksSection() {
  const [activeTab, setActiveTab] = useState("apikeys");

  return (
    <div style={{ marginTop: "2.5rem" }}>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <KeySquare size={18} className="text-purple" />
          <h3>B2B Integration — API Keys & Webhooks</h3>
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button className={`action-btn ${activeTab === "apikeys" ? "primary" : "secondary"} text-xs`} onClick={() => setActiveTab("apikeys")}>
            <KeySquare size={12} /> API Keys
          </button>
          <button className={`action-btn ${activeTab === "webhooks" ? "primary" : "secondary"} text-xs`} onClick={() => setActiveTab("webhooks")}>
            <Webhook size={12} /> Webhooks
          </button>
        </div>
      </div>
      <div className="glass-card">
        {activeTab === "apikeys" && <ApiKeyPane />}
        {activeTab === "webhooks" && <WebhookPane />}
      </div>
    </div>
  );
}
