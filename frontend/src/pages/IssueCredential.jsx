import React, { useState, useEffect, useRef } from "react";
import {
  Award, ShieldCheck, AlertCircle, CheckCircle2,
  Upload, Download, FileText, Users, AlertTriangle, X, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const CRED_TYPES = [
  "DEGREE", "EMPLOYMENT_VERIFICATION", "CERTIFICATION", "LICENSE", "SECURITY_CLEARANCE", "OTHER"
];

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
  return { headers, rows };
}

const SAMPLE_CSV = `recipientId,documentId,credentialType,title,validityDays
usr_example001,doc_example001,DEGREE,Bachelor of Computer Science,1825
usr_example002,doc_example002,CERTIFICATION,AWS Cloud Practitioner,365
usr_example003,doc_example003,EMPLOYMENT_VERIFICATION,Senior Software Engineer Acme Corp,730`;

export default function IssueCredential({ initialParams = {}, onNavigate }) {
  const { user } = useAuth();
  const [issuers, setIssuers] = useState([]);
  const [selectedIssuerId, setSelectedIssuerId] = useState("");
  const [recipientId, setRecipientId] = useState(initialParams.recipientId || "");
  const [documentId, setDocumentId] = useState(initialParams.documentId || "");
  const [credentialType, setCredentialType] = useState("DEGREE");
  const [title, setTitle] = useState("");
  const [validityDays, setValidityDays] = useState(730);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [issuedResult, setIssuedResult] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableDocs, setAvailableDocs] = useState([]);
  const [activeTab, setActiveTab] = useState("single");
  const fileRef = useRef(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [bulkIssuerId, setBulkIssuerId] = useState("");
  const [bulkPreviewing, setBulkPreviewing] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkError, setBulkError] = useState("");
  const [showResultDetail, setShowResultDetail] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.issuers.list({ limit: 100 });
        if (res && res.success) {
          const list = res.data.issuers || [];
          setIssuers(list);
          const ui = list.find((i) => i.userId === user?.userId && i.status === "ACTIVE");
          const active = ui || list.find((i) => i.status === "ACTIVE");
          if (active) { setSelectedIssuerId(active.issuerId); setBulkIssuerId(active.issuerId); }
          else if (list[0]) { setSelectedIssuerId(list[0].issuerId); setBulkIssuerId(list[0].issuerId); }
        }
      } catch {}
      try { const r = await api.users.list({ limit: 10 }); if (r?.success) setAvailableUsers(r.data.users || []); } catch {}
      try { const r = await api.documents.list({ limit: 5 }); if (r?.success) setAvailableDocs(r.data.documents || []); } catch {}
    }
    loadData();
  }, []);

  async function handleIssue(e) {
    e.preventDefault();
    if (!selectedIssuerId || !recipientId || !documentId || !title) { setError("Please fill in all required fields."); return; }
    setError(""); setLoading(true); setIssuedResult(null);
    try {
      const res = await api.credentials.issue({ issuerId: selectedIssuerId, recipientId: recipientId.trim(), documentId: documentId.trim(), credentialType, title: title.trim(), validityDays: Number(validityDays) || 365 });
      if (res && res.success) setIssuedResult(res.data);
      else setError(res?.error?.message || "Failed to issue credential");
    } catch (err) { setError(err.message || "Issuance request failed"); }
    finally { setLoading(false); }
  }

  function handleFileChange(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      setCsvHeaders(parsed.headers); setCsvRows(parsed.rows);
      setBulkPreviewing(true); setBulkResults(null); setBulkError("");
    };
    reader.readAsText(file);
  }

  function downloadSampleCSV() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "bulk_issue_sample.csv";
    a.click(); URL.revokeObjectURL(url);
  }

  async function handleBulkIssue() {
    if (!csvRows.length || !bulkIssuerId) { setBulkError("Upload a CSV file and select an issuer first."); return; }
    setBulkError(""); setBulkLoading(true); setBulkResults(null);
    try {
      const credentials = csvRows.map((row) => ({
        issuerId: bulkIssuerId,
        recipientId: row.recipientId || row.recipient_id || "",
        documentId: row.documentId || row.document_id || "",
        credentialType: row.credentialType || row.credential_type || "OTHER",
        title: row.title || "",
        validityDays: Number(row.validityDays || row.validity_days) || 365
      }));
      const res = await api.credentials.bulkIssue({ credentials });
      if (res && res.success) { setBulkResults(res.data); setShowResultDetail(true); }
      else setBulkError(res?.error?.message || "Bulk issuance failed");
    } catch (err) { setBulkError(err.message || "Bulk issuance error"); }
    finally { setBulkLoading(false); }
  }

  function resetBulk() {
    setCsvHeaders([]); setCsvRows([]); setBulkPreviewing(false);
    setBulkResults(null); setBulkError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Issue Signed Workforce Credential</h2>
          <p className="page-subtitle">Generate Ed25519 digital signature over canonical RFC 8785 payload and record hash-chained audit trail.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className={`action-btn ${activeTab === "single" ? "primary" : "secondary"} text-xs`} onClick={() => setActiveTab("single")}><Award size={13} /> Single Issue</button>
          <button className={`action-btn ${activeTab === "bulk" ? "primary" : "secondary"} text-xs`} onClick={() => setActiveTab("bulk")}><Users size={13} /> Bulk CSV</button>
        </div>
      </div>

      {activeTab === "single" && (
        <div className="two-column-layout">
          <div className="glass-card">
            <h3>Credential Specifications</h3>
            <p className="text-secondary text-sm" style={{ marginBottom: "1.25rem" }}>Issuing requires an active issuer profile and an active Ed25519 cryptographic key pair.</p>
            {error && <div className="alert-banner danger" style={{ marginBottom: "1rem" }}><AlertCircle size={16} /><span>{error}</span></div>}
            <form onSubmit={handleIssue}>
              <div className="form-group">
                <label>Issuing Authority Profile</label>
                <select className="select-input" value={selectedIssuerId} onChange={(e) => setSelectedIssuerId(e.target.value)} required>
                  {issuers.map((i) => <option key={i.issuerId} value={i.issuerId}>{i.issuerCode} ({i.status}) - {i.issuerId}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Recipient Subject (User ID)</label>
                <input type="text" placeholder="usr_0123456789abcdef" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} required />
                {availableUsers.length > 0 && (
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                    <span className="text-muted text-xs" style={{ alignSelf: "center" }}>Quick select:</span>
                    {availableUsers.filter((u) => u.role === "USER" || u.email.includes("scholar")).slice(0, 3).map((u) => (
                      <button type="button" key={u.userId} className="persona-pill text-xs" style={{ padding: "2px 8px", fontSize: "0.72rem", cursor: "pointer" }} onClick={() => setRecipientId(u.userId)}>{u.name || u.email}</button>
                    ))}
                  </div>
                )}
                <span className="text-muted text-xs">The verified user ID representing the credential recipient.</span>
              </div>
              <div className="form-group">
                <label>Document Artifact ID</label>
                <input type="text" placeholder="doc_0123456789abcdef" value={documentId} onChange={(e) => setDocumentId(e.target.value)} required />
                {availableDocs.length > 0 && (
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                    <span className="text-muted text-xs" style={{ alignSelf: "center" }}>Recent uploads:</span>
                    {availableDocs.slice(0, 2).map((d) => (
                      <button type="button" key={d.documentId} className="persona-pill text-xs" style={{ padding: "2px 8px", fontSize: "0.72rem", cursor: "pointer" }} onClick={() => setDocumentId(d.documentId)}>{d.originalFilename ? `${d.originalFilename.slice(0, 16)}...` : d.documentId}</button>
                    ))}
                  </div>
                )}
                <span className="text-muted text-xs">Artifact ID from document upload representing the source document.</span>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Credential Type</label>
                  <select className="select-input" value={credentialType} onChange={(e) => setCredentialType(e.target.value)}>
                    {CRED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Validity (Days)</label>
                  <input type="number" min="1" max="3650" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Credential Title / Award Designation</label>
                <input type="text" placeholder="e.g. Master of Science in Cybersecurity" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <button type="submit" className="action-btn primary full-width" disabled={loading}>
                <Award size={16} />{loading ? "Generating Canonical Signature..." : "Issue & Sign Credential"}
              </button>
            </form>
          </div>
          <div className="glass-card">
            <h3>Cryptographic Issuance Outcome</h3>
            {issuedResult ? (
              <div>
                <div className="alert-banner success" style={{ marginBottom: "1rem" }}><CheckCircle2 size={16} /><span>Credential issued and digitally signed successfully.</span></div>
                <div className="detail-row"><span className="detail-label">Credential ID</span><span className="code-snippet">{issuedResult.credential.credentialId}</span></div>
                <div className="detail-row"><span className="detail-label">Version ID</span><span className="code-snippet">{issuedResult.credential.currentVersionId}</span></div>
                <div className="detail-row"><span className="detail-label">Issuer Key ID</span><span className="code-snippet">{issuedResult.version.issuerKeyId}</span></div>
                <div className="detail-row"><span className="detail-label">Digital Signature</span><span className="code-snippet hash-text">{issuedResult.version.signature}</span></div>
                <div style={{ marginTop: "1.5rem" }}>
                  <h4>Canonical Payload Signed</h4>
                  <div className="json-code-box"><pre>{JSON.stringify(issuedResult.version.signedPayload, null, 2)}</pre></div>
                </div>
                <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button className="action-btn primary text-xs" onClick={() => onNavigate("credential_list", { credentialId: issuedResult.credential.credentialId })}><Award size={14} /> View in Registry</button>
                  <button className="action-btn secondary text-xs" onClick={() => onNavigate("verify_document", { credentialId: issuedResult.credential.credentialId })}><ShieldCheck size={14} /> Verify Credential</button>
                  <button className="action-btn secondary text-xs" onClick={() => { setIssuedResult(null); setTitle(""); }}>Issue Another</button>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <Award size={36} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
                <p>No credential issued in this session.</p>
                <span className="text-muted text-xs">Fill in the specifications on the left to sign a credential payload.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "bulk" && (
        <div>
          <div className="glass-card" style={{ marginBottom: "1.5rem" }}>
            <div className="section-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Users size={20} className="text-cyan" /><h3>Bulk CSV Issuance</h3>
              </div>
              <button className="action-btn secondary text-xs" onClick={downloadSampleCSV}><Download size={13} /> Download Sample CSV</button>
            </div>
            <p className="text-secondary text-sm" style={{ marginBottom: "1rem" }}>
              Upload a CSV with columns: <code>recipientId, documentId, credentialType, title, validityDays</code>. All rows validated before issuance.
            </p>
            <div className="form-group" style={{ maxWidth: "420px" }}>
              <label>Issuing Authority (applied to all rows)</label>
              <select className="select-input" value={bulkIssuerId} onChange={(e) => setBulkIssuerId(e.target.value)}>
                {issuers.map((i) => <option key={i.issuerId} value={i.issuerId}>{i.issuerCode} ({i.status})</option>)}
              </select>
            </div>
            <div
              style={{ border: "2px dashed rgba(0,240,255,0.3)", borderRadius: "10px", padding: "2rem", textAlign: "center", cursor: "pointer", background: "rgba(0,240,255,0.03)" }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileChange({ target: { files: [f] } }); }}
            >
              <Upload size={28} style={{ opacity: 0.5, marginBottom: "0.5rem" }} />
              <p style={{ margin: 0 }}>Drop CSV file here or <span className="text-cyan" style={{ textDecoration: "underline" }}>browse</span></p>
              <span className="text-muted text-xs">Accepts .csv only</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFileChange} />
            </div>
            {csvRows.length > 0 && (
              <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <CheckCircle2 size={14} className="text-success" />
                <span className="text-sm"><strong>{csvRows.length}</strong> row(s) loaded</span>
                <button className="action-btn secondary text-xs" onClick={resetBulk}><X size={12} /> Clear</button>
              </div>
            )}
          </div>

          {bulkPreviewing && csvRows.length > 0 && !bulkResults && (
            <div className="glass-card" style={{ marginBottom: "1.5rem" }}>
              <div className="section-header">
                <h3>Preview — {csvRows.length} Credential(s) to Issue</h3>
                <button className="action-btn primary text-xs" onClick={handleBulkIssue} disabled={bulkLoading}>
                  {bulkLoading ? <><RefreshCw size={13} className="pulse-dot" /> Issuing...</> : <><Award size={13} /> Issue All ({csvRows.length})</>}
                </button>
              </div>
              {bulkError && <div className="alert-banner danger" style={{ marginBottom: "1rem" }}><AlertTriangle size={14} /><span>{bulkError}</span></div>}
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>#</th>{csvHeaders.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {csvRows.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        <td className="text-muted text-xs">{i + 1}</td>
                        {csvHeaders.map((h) => <td key={h} style={h.includes("Id") ? { fontFamily: "monospace", fontSize: "0.75rem" } : {}}>{row[h] || "—"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.length > 10 && <p className="text-muted text-xs" style={{ padding: "0.5rem 0.75rem" }}>... and {csvRows.length - 10} more rows</p>}
              </div>
            </div>
          )}

          {bulkResults && (
            <div className="glass-card">
              <div className="section-header">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}><FileText size={20} className="text-cyan" /><h3>Batch Issuance Report</h3></div>
                <button className="action-btn secondary text-xs" onClick={resetBulk}><RefreshCw size={12} /> New Batch</button>
              </div>
              <div className="metrics-grid" style={{ marginBottom: "1.5rem" }}>
                <div className="metric-card glass-card"><div className="metric-icon bg-cyan-subtle"><Award size={18} className="text-cyan" /></div><div className="metric-value">{bulkResults.total ?? csvRows.length}</div><div className="metric-label">Total Submitted</div></div>
                <div className="metric-card glass-card"><div className="metric-icon bg-green-subtle"><CheckCircle2 size={18} className="text-success" /></div><div className="metric-value" style={{ color: "var(--accent-green)" }}>{bulkResults.issued?.length ?? bulkResults.successCount ?? 0}</div><div className="metric-label">Issued Successfully</div></div>
                <div className="metric-card glass-card"><div className="metric-icon" style={{ background: "rgba(239,68,68,0.12)" }}><AlertTriangle size={18} style={{ color: "var(--color-danger)" }} /></div><div className="metric-value" style={{ color: "var(--color-danger)" }}>{bulkResults.failed?.length ?? bulkResults.failCount ?? 0}</div><div className="metric-label">Failed / Skipped</div></div>
              </div>
              <button className="action-btn secondary text-xs" style={{ marginBottom: "1rem" }} onClick={() => setShowResultDetail((v) => !v)}>
                {showResultDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {showResultDetail ? "Collapse" : "Expand"} Per-Row Detail
              </button>
              {showResultDetail && (
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Credential ID</th><th>Title</th><th>Status</th><th>Error</th></tr></thead>
                    <tbody>
                      {(bulkResults.issued || []).map((r, i) => (
                        <tr key={`ok-${i}`}>
                          <td className="text-muted text-xs">{i + 1}</td>
                          <td className="code-snippet">{r.credentialId || r.credential?.credentialId}</td>
                          <td>{r.title || r.credential?.title}</td>
                          <td><span className="badge-tag" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>ISSUED</span></td>
                          <td className="text-muted text-xs">—</td>
                        </tr>
                      ))}
                      {(bulkResults.failed || []).map((r, i) => (
                        <tr key={`fail-${i}`}>
                          <td className="text-muted text-xs">{(bulkResults.issued?.length || 0) + i + 1}</td>
                          <td className="text-muted text-xs">—</td>
                          <td>{r.title || r.input?.title || "—"}</td>
                          <td><span className="badge-tag" style={{ background: "rgba(239,68,68,0.12)", color: "var(--color-danger)" }}>FAILED</span></td>
                          <td className="text-muted text-xs">{r.error || r.message || "Unknown error"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {onNavigate && (
        <div className="glass-card" style={{ marginTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <span className="text-muted text-xs">Issuer Workflow: Key Status → Issue Credential (Single / Bulk) → Credential Registry</span>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="action-btn secondary text-xs" onClick={() => onNavigate("key_status")}>Back to Key Status</button>
            <button className="action-btn primary text-xs" onClick={() => onNavigate("credential_list")}>Credential Registry</button>
          </div>
        </div>
      )}
    </div>
  );
}
