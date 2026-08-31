import React, { useState, useEffect } from 'react';
import { Cpu, FileText, AlertTriangle, CheckCircle2, RefreshCw, AlertOctagon, Search } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function DocumentAnalysis({ initialParams = {} }) {
  const [documentId, setDocumentId] = useState(initialParams.documentId || '');
  const [ocrResult, setOcrResult] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialParams.documentId) {
      loadStoredAnalysis(initialParams.documentId);
    }
  }, [initialParams.documentId]);

  async function loadStoredAnalysis(docId) {
    if (!docId) return;
    try {
      const res = await api.analysis.getByDocumentId(docId);
      if (res && res.success) {
        if (res.data.ocrAnalysis) setOcrResult(res.data.ocrAnalysis);
        if (res.data.aiAnalysis) setAiResult(res.data.aiAnalysis);
      }
    } catch {}
  }

  async function handleRunOcr(e) {
    if (e) e.preventDefault();
    if (!documentId) {
      setError('Please enter a Document ID.');
      return;
    }
    setError('');
    setLoadingOcr(true);
    try {
      const res = await api.analysis.runOcr(documentId.trim());
      if (res && res.success) {
        setOcrResult(res.data.analysis);
      } else {
        setError(res?.error?.message || 'OCR analysis failed');
      }
    } catch (err) {
      setError(err.message || 'OCR request failed');
    } finally {
      setLoadingOcr(false);
    }
  }

  async function handleRunAi(e) {
    if (e) e.preventDefault();
    if (!documentId) {
      setError('Please enter a Document ID.');
      return;
    }
    setError('');
    setLoadingAi(true);
    try {
      const res = await api.analysis.runAi(documentId.trim());
      if (res && res.success) {
        setAiResult(res.data.analysis);
      } else {
        setError(res?.error?.message || 'AI analysis failed');
      }
    } catch (err) {
      setError(err.message || 'AI request failed');
    } finally {
      setLoadingAi(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Document Analysis (Local OCR & AI Heuristics)</h2>
          <p className="page-subtitle">
            Extract text and compute tampering heuristics strictly as supplementary evidence without paid cloud APIs.
          </p>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <h3>Target Document</h3>
        <p className="text-secondary text-sm" style={{ marginBottom: '1rem' }}>
          Enter the Document Artifact ID (e.g. from the Upload Document screen) to run local OCR extraction or heuristic tampering detection.
        </p>

        {error && (
          <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-grid-3">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Document ID</label>
            <div className="input-icon-wrapper">
              <Search size={16} className="input-icon" />
              <input
                type="text"
                placeholder="doc_0123456789abcdef"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <button className="action-btn secondary text-xs" onClick={handleRunOcr} disabled={loadingOcr}>
              <FileText size={14} />
              {loadingOcr ? 'Extracting OCR...' : 'Run Local OCR'}
            </button>
            <button className="action-btn primary text-xs" onClick={handleRunAi} disabled={loadingAi}>
              <Cpu size={14} />
              {loadingAi ? 'Analyzing Heuristics...' : 'Run Local AI'}
            </button>
          </div>
        </div>
      </div>

      <div className="two-column-layout">
        {/* OCR Result */}
        <div className="glass-card">
          <div className="section-header">
            <h3><FileText size={18} className="text-cyan" /> OCR Evidence Extraction</h3>
            {ocrResult && <span className="level-badge">{ocrResult.ocrEngine || 'Local OCR'}</span>}
          </div>

          {ocrResult ? (
            <div>
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <StatusBadge status={ocrResult.status || 'EXTRACTED'} />
              </div>
              <div className="detail-row">
                <span className="detail-label">Engine Version</span>
                <span>{ocrResult.ocrVersion || '1.0.0'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Timestamp</span>
                <span className="text-muted text-xs">{new Date(ocrResult.ocrTimestamp || ocrResult.createdAt).toLocaleString()}</span>
              </div>

              {ocrResult.extractedFields && Object.keys(ocrResult.extractedFields).length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4>Structured Fields</h4>
                  <div className="fields-box">
                    {Object.entries(ocrResult.extractedFields).map(([k, v]) => (
                      <div key={k} className="field-chip">
                        <strong>{k}:</strong> {String(v)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1rem' }}>
                <h4>Extracted Text Content</h4>
                <div className="raw-text-box">
                  {ocrResult.ocrText || '<No textual content detected>'}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <FileText size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No OCR analysis run yet.</p>
              <span className="text-muted text-xs">Run Local OCR above to view extracted text and fields.</span>
            </div>
          )}
        </div>

        {/* AI Result */}
        <div className="glass-card">
          <div className="section-header">
            <h3><Cpu size={18} className="text-purple" /> AI Tampering Analysis</h3>
            {aiResult && <span className="level-badge">{aiResult.modelName || 'Heuristic Model'}</span>}
          </div>

          {aiResult ? (
            <div>
              <div className="detail-row">
                <span className="detail-label">Assessed Risk Level</span>
                <StatusBadge status={aiResult.riskLevel} />
              </div>
              <div className="detail-row">
                <span className="detail-label">Risk Score</span>
                <strong>{(aiResult.riskScore * 100).toFixed(1)}% ({aiResult.riskScore})</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Tampering Detected</span>
                <span>{aiResult.tamperingDetected ? 'YES - Suspicious Patterns' : 'NO'}</span>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <h4>Heuristic Findings & Alerts</h4>
                {aiResult.findings && aiResult.findings.length > 0 ? (
                  <ul className="findings-list">
                    {aiResult.findings.map((f, i) => (
                      <li key={i} className="finding-item">
                        <AlertOctagon size={14} className="text-warning" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-success text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} /> No document manipulation or tampering anomalies detected.
                  </p>
                )}
              </div>

              <div className="alert-banner neutral" style={{ marginTop: '1.5rem', fontSize: '0.78rem' }}>
                <span><strong>Core Trust Principle:</strong> AI findings are strictly supplementary. AI cannot override valid cryptographic signatures or replace official source evidence.</span>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <Cpu size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No AI analysis run yet.</p>
              <span className="text-muted text-xs">Run Local AI to inspect heuristic font, metadata, and structural consistency.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
