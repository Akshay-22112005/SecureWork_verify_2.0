import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Search,
  Upload,
  ShieldAlert,
  ShieldCheck,
  Info,
  Clock,
  FileSearch,
  Layers,
  Sparkles,
  ArrowRight,
  Copy,
  Check
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

function ConfidenceRing({ score = 0, size = 90, strokeWidth = 8, label = 'Confidence' }) {
  const percentage = Math.round(score > 1 ? score : score * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;
  
  const color = percentage >= 85 
    ? 'var(--accent-emerald, #10b981)' 
    : percentage >= 60 
      ? 'var(--accent-amber, #f59e0b)' 
      : 'var(--accent-red, #ef4444)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
      <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--border-subtle, rgba(255, 255, 255, 0.1))"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {percentage}%
          </span>
        </div>
      </div>
      {label && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>}
    </div>
  );
}

export default function DocumentAnalysis({ initialParams = {}, onNavigate }) {
  const [documentId, setDocumentId] = useState(initialParams.documentId || '');
  const [ocrResult, setOcrResult] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'raw_text'

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialParams.documentId) {
      setDocumentId(initialParams.documentId);
      loadStoredAnalysis(initialParams.documentId);
    }
  }, [initialParams.documentId]);

  async function loadStoredAnalysis(docId) {
    if (!docId) return;
    try {
      const res = await api.analysis.getByDocumentId(docId);
      if (res && res.success) {
        if (res.data?.analysis?.ocr || res.data?.ocrAnalysis) {
          setOcrResult(res.data.analysis?.ocr || res.data.ocrAnalysis);
        }
        if (res.data?.analysis?.ai || res.data?.aiAnalysis) {
          setAiResult(res.data.analysis?.ai || res.data.aiAnalysis);
        }
      }
    } catch (err) {
      // Non-blocking load
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;
    setError('');
    setUploading(true);
    setOcrResult(null);
    setAiResult(null);

    const formData = new FormData();
    formData.append('document', file);
    formData.append('representationType', file.type.includes('pdf') ? 'ORIGINAL_PDF' : 'IMAGE');

    try {
      const res = await api.analysis.upload(formData);
      if (res && res.success) {
        if (res.data?.documentId) {
          setDocumentId(res.data.documentId);
        }
        if (res.data?.ocrAnalysis) {
          setOcrResult(res.data.ocrAnalysis);
        }
        if (res.data?.aiAnalysis) {
          setAiResult(res.data.aiAnalysis);
        }
      } else {
        setError(res?.error?.message || 'File analysis failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload and analyze document');
    } finally {
      setUploading(false);
    }
  }

  async function handleRunOcr(e) {
    if (e) e.preventDefault();
    if (!documentId.trim()) {
      setError('Please enter or select a Document ID.');
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
    if (!documentId.trim()) {
      setError('Please enter or select a Document ID.');
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

  function handleCopyText() {
    if (ocrResult?.ocrText) {
      navigator.clipboard.writeText(ocrResult.ocrText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  }

  const overallConfidence = ocrResult?.confidence !== undefined ? ocrResult.confidence : 0;
  const isLowConfidence = ocrResult && overallConfidence < 0.85;

  const rawFields = ocrResult?.extractedFields || {};
  const fieldConfidences = rawFields.fieldConfidences || {};

  const structuredFieldsList = [
    { key: 'recipientName', label: 'Recipient Name', value: rawFields.recipientName, conf: fieldConfidences.recipientName },
    { key: 'organizationName', label: 'Organization / Institution', value: rawFields.organizationName, conf: fieldConfidences.organizationName },
    { key: 'credentialTitle', label: 'Credential Title', value: rawFields.credentialTitle, conf: fieldConfidences.credentialTitle },
    { key: 'issueDate', label: 'Issue / Conferred Date', value: rawFields.issueDate, conf: fieldConfidences.issueDate },
    { key: 'identifier', label: 'Identifier / License / Reg ID', value: rawFields.identifier, conf: fieldConfidences.identifier }
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2>Document Analysis &amp; Forensic Inspection</h2>
            <span className="level-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              Offline Tesseract v7 + AI Heuristics
            </span>
          </div>
          <p className="page-subtitle">
            Extract textual evidence, compute field-level confidence scores, and analyze tampering anomalies locally without external cloud dependencies.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Dropzone & Document ID Input Card */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', position: 'relative' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Upload size={18} className="text-cyan" /> Upload Document or Analyze by ID
        </h3>
        <p className="text-secondary text-sm" style={{ marginBottom: '1.25rem' }}>
          Drop any PDF certificate, diploma image (PNG/JPG), or enter an existing Document Artifact ID to run local OCR extraction and forensic checks.
        </p>

        {/* Drag & Drop Box */}
        <div
          className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
          style={{
            border: `2px dashed ${dragActive ? 'var(--accent-teal, #06b6d4)' : 'var(--border-card, rgba(255, 255, 255, 0.15))'}`,
            borderRadius: '12px',
            padding: '1.75rem',
            textAlign: 'center',
            background: dragActive ? 'rgba(6, 182, 212, 0.05)' : 'var(--bg-card-subtle, rgba(255, 255, 255, 0.02))',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            marginBottom: '1.25rem'
          }}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
          {uploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div className="loading-spinner" />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Extracting OCR &amp; Running Heuristic Tamper Detection...</span>
              <span className="text-muted text-xs">Processing local Tesseract OCR &amp; offline PDF stream analysis</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={32} style={{ color: 'var(--accent-teal, #06b6d4)', opacity: 0.8 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                Drag &amp; drop qualification PDF or certificate image, or <span style={{ color: 'var(--accent-teal, #06b6d4)', textDecoration: 'underline' }}>browse file</span>
              </div>
              <span className="text-muted text-xs">Supports PDF, PNG, JPG, JPEG (Max 10 MB). Processed 100% offline.</span>
            </div>
          )}
        </div>

        {/* Existing Document ID search input */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div className="input-icon-wrapper">
              <Search size={16} className="input-icon" />
              <input
                type="text"
                placeholder="Or analyze existing Document ID (e.g. doc_123456789abcdef)"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <button className="action-btn secondary text-xs" onClick={handleRunOcr} disabled={loadingOcr || uploading}>
            <FileText size={14} />
            {loadingOcr ? 'Extracting OCR...' : 'Run Local OCR'}
          </button>
          <button className="action-btn primary text-xs" onClick={handleRunAi} disabled={loadingAi || uploading}>
            <Cpu size={14} />
            {loadingAi ? 'Analyzing...' : 'Run Tamper Check'}
          </button>
        </div>
      </div>

      {/* Low Confidence Warning Banner */}
      {isLowConfidence && (
        <div className="alert-banner warning" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid var(--accent-amber, #f59e0b)' }}>
          <AlertTriangle size={22} className="text-warning" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Needs Human Review: Low Extraction Confidence ({(overallConfidence * 100).toFixed(1)}%)</strong>
            <span style={{ fontSize: '0.82rem' }}>
              The extracted text confidence is below the recommended 85% threshold. Some characters, names, or registration numbers may require manual visual inspection before issuing or verifying credentials.
            </span>
          </div>
        </div>
      )}

      {/* Analysis Grid */}
      <div className="two-column-layout">
        {/* Left Card: OCR Evidence Extraction & Fields */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSearch size={20} className="text-cyan" />
              <h3 style={{ margin: 0 }}>OCR Evidence Extraction</h3>
            </div>
            {ocrResult && (
              <span className="level-badge" style={{ fontSize: '0.72rem' }}>
                {ocrResult.ocrEngine || 'Local OCR'}
              </span>
            )}
          </div>

          {ocrResult ? (
            <div>
              {/* Top Meter Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-card-subtle, rgba(255,255,255,0.03))', borderRadius: '10px', marginBottom: '1.25rem' }}>
                <ConfidenceRing score={overallConfidence} label="Overall Score" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, marginLeft: '1.5rem' }}>
                  <div className="detail-row" style={{ margin: 0, padding: '0.2rem 0' }}>
                    <span className="detail-label">Status</span>
                    <StatusBadge status={ocrResult.status || 'SUCCESS'} />
                  </div>
                  <div className="detail-row" style={{ margin: 0, padding: '0.2rem 0' }}>
                    <span className="detail-label">Engine / Version</span>
                    <span className="text-xs">{ocrResult.ocrVersion || '7.0.0'}</span>
                  </div>
                  <div className="detail-row" style={{ margin: 0, padding: '0.2rem 0' }}>
                    <span className="detail-label">Extraction Time</span>
                    <span className="text-xs text-muted">{ocrResult.executionDurationMs || ocrResult.durationMs || 0} ms</span>
                  </div>
                </div>
              </div>

              {/* View Switcher: Structured Fields vs Raw Text */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', paddingBottom: '0.5rem' }}>
                <button
                  className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                  style={{
                    background: activeTab === 'summary' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                    border: 'none',
                    color: activeTab === 'summary' ? 'var(--accent-teal, #06b6d4)' : 'var(--text-secondary)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveTab('summary')}
                >
                  <Layers size={14} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: 'middle' }} />
                  Structured Fields Table
                </button>
                <button
                  className={`tab-btn ${activeTab === 'raw_text' ? 'active' : ''}`}
                  style={{
                    background: activeTab === 'raw_text' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                    border: 'none',
                    color: activeTab === 'raw_text' ? 'var(--accent-teal, #06b6d4)' : 'var(--text-secondary)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveTab('raw_text')}
                >
                  <FileText size={14} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: 'middle' }} />
                  Raw Extracted Text
                </button>
              </div>

              {activeTab === 'summary' ? (
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.5rem 0.5rem' }}>Field</th>
                        <th style={{ padding: '0.5rem 0.5rem' }}>Extracted Value</th>
                        <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right' }}>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {structuredFieldsList.map((f) => {
                        const confPercent = f.conf ? Math.round(f.conf > 1 ? f.conf : f.conf * 100) : (f.value ? 90 : 0);
                        return (
                          <tr key={f.key} style={{ borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.05))' }}>
                            <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {f.label}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem', color: f.value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {f.value || '<Not Detected>'}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                              {f.value ? (
                                <span
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: confPercent >= 85 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                    color: confPercent >= 85 ? 'var(--accent-emerald, #10b981)' : 'var(--accent-amber, #f59e0b)'
                                  }}
                                >
                                  {confPercent}%
                                </span>
                              ) : (
                                <span className="text-muted text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span className="text-muted text-xs">OCR Raw Stream Buffer</span>
                    <button
                      onClick={handleCopyText}
                      className="action-btn secondary text-xs"
                      style={{ padding: '0.2rem 0.6rem' }}
                    >
                      {copiedText ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                      {copiedText ? 'Copied' : 'Copy Text'}
                    </button>
                  </div>
                  <div
                    className="raw-text-box"
                    style={{
                      maxHeight: '260px',
                      overflowY: 'auto',
                      padding: '0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {ocrResult.ocrText || '<No textual content detected>'}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
              <FileText size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No OCR analysis performed yet</p>
              <span className="text-muted text-xs">Drop a document file above or click "Run Local OCR" to extract text.</span>
            </div>
          )}
        </div>

        {/* Right Card: AI Tampering & Heuristic Analysis */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={20} className="text-purple" />
              <h3 style={{ margin: 0 }}>AI Tamper &amp; Anomaly Analysis</h3>
            </div>
            {aiResult && (
              <span className="level-badge" style={{ fontSize: '0.72rem' }}>
                {aiResult.modelName || 'Heuristic Tamper Model'}
              </span>
            )}
          </div>

          {aiResult ? (
            <div>
              {/* Anomaly Gauge / Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-card-subtle, rgba(255,255,255,0.03))', borderRadius: '10px', marginBottom: '1.25rem' }}>
                <ConfidenceRing
                  score={aiResult.score !== undefined ? aiResult.score : (aiResult.riskScore || 0)}
                  label="Anomaly Score"
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, marginLeft: '1.5rem' }}>
                  <div className="detail-row" style={{ margin: 0, padding: '0.2rem 0' }}>
                    <span className="detail-label">Assessed Risk Level</span>
                    <StatusBadge status={aiResult.riskLevel || 'LOW'} />
                  </div>
                  <div className="detail-row" style={{ margin: 0, padding: '0.2rem 0' }}>
                    <span className="detail-label">Tampering Indicator</span>
                    <span style={{ fontWeight: 700, color: aiResult.tamperingDetected ? 'var(--accent-red, #ef4444)' : 'var(--accent-emerald, #10b981)' }}>
                      {aiResult.tamperingDetected ? 'SUSPICIOUS PATTERNS DETECTED' : 'NO ANOMALIES DETECTED'}
                    </span>
                  </div>
                  <div className="detail-row" style={{ margin: 0, padding: '0.2rem 0' }}>
                    <span className="detail-label">Engine Duration</span>
                    <span className="text-xs text-muted">{aiResult.executionDurationMs || aiResult.durationMs || 0} ms</span>
                  </div>
                </div>
              </div>

              {/* Heuristic Findings & Flagged Reasons List */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={15} className="text-purple" /> Heuristic Forensic Findings ({aiResult.findings?.length || 0})
                </h4>

                {aiResult.findings && aiResult.findings.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                    {aiResult.findings.map((f, i) => {
                      const isHigh = f.severity === 'CRITICAL' || f.severity === 'HIGH';
                      const isMed = f.severity === 'MEDIUM';
                      const bg = isHigh ? 'rgba(239, 68, 68, 0.1)' : isMed ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)';
                      const border = isHigh ? 'rgba(239, 68, 68, 0.3)' : isMed ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)';
                      const iconColor = isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#3b82f6';

                      return (
                        <div
                          key={i}
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderRadius: '8px',
                            background: bg,
                            border: `1px solid ${border}`,
                            display: 'flex',
                            gap: '0.6rem',
                            alignItems: 'flex-start'
                          }}
                        >
                          <AlertOctagon size={16} style={{ color: iconColor, marginTop: '2px', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.78rem', color: iconColor }}>{f.code}</span>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}>
                                {f.severity}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                              {f.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <ShieldCheck size={20} className="text-emerald" />
                    <div>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--accent-emerald, #10b981)', display: 'block' }}>Clean Document Verification</strong>
                      <span className="text-muted text-xs">No metadata tampering, font anomalies, homoglyph substitutions, or post-creation edits found.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Advisory Legal / Trust Invariant Banner */}
              <div
                className="alert-banner neutral"
                style={{
                  fontSize: '0.76rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start'
                }}
              >
                <Info size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-teal, #06b6d4)' }} />
                <span>
                  <strong>Advisory Principle:</strong> AI tamper findings are strictly supplementary and heuristic. AI analysis never overrides cryptographic digital signatures, issuer revocation status, or authentic ledger proof.
                </span>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
              <Cpu size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No AI Tamper Analysis performed yet</p>
              <span className="text-muted text-xs">Drop a document file above or click "Run Tamper Check" to inspect heuristics.</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      {onNavigate && (
        <div className="glass-card" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="text-muted text-xs">Holder Workflow: Upload Document → Document Analysis → Issue / Verify Credential</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="action-btn secondary text-xs" onClick={() => onNavigate('upload_document')}>
              ← Upload Another Document
            </button>
            <button className="action-btn primary text-xs" onClick={() => onNavigate('my_credentials', { documentId })}>
              Proceed to My Credentials <ArrowRight size={14} />
            </button>
            <button className="action-btn secondary text-xs" onClick={() => onNavigate('verify_document', { documentId })}>
              Verify Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
