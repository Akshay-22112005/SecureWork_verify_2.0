import React, { useState } from 'react';
import { UploadCloud, FileCheck, AlertCircle, ArrowRight, Copy, Check, Cpu } from 'lucide-react';
import api from '../services/api';

export default function UploadDocument({ onNavigate, onDocumentUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 10 * 1024 * 1024) {
        setError('File exceeds maximum size limit of 10 MB.');
        return;
      }
      setError('');
      setFile(selected);
      setUploadedDoc(null);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.documents.upload(formData);
      if (res && res.success) {
        setUploadedDoc(res.data.document);
        if (typeof onDocumentUploaded === 'function') {
          onDocumentUploaded(res.data.document);
        }
      } else {
        setError(res?.error?.message || 'Failed to upload document');
      }
    } catch (err) {
      setError(err.message || 'Network upload failed');
    } finally {
      setUploading(false);
    }
  }

  function copyHash(hash) {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Upload Workforce Document</h2>
          <p className="page-subtitle">
            Securely persist documents to local storage with cryptographic SHA-256 integrity digest generation.
          </p>
        </div>
      </div>

      <div className="two-column-layout">
        {/* Upload Box */}
        <div className="glass-card">
          <h3>Select Document File</h3>
          <p className="text-secondary text-sm" style={{ marginBottom: '1.5rem' }}>
            Supported formats: PDF, PNG, JPEG. Max size: 10 MB. Files are stored locally without external third-party cloud leaks.
          </p>

          {error && (
            <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUpload}>
            <div className="dropzone-box">
              <UploadCloud size={40} className="text-cyan" style={{ marginBottom: '0.75rem' }} />
              <p><strong>Click to browse</strong> or drag and drop file here</p>
              <span className="text-muted text-xs">PDF, PNG, JPG up to 10MB</span>
              <input
                type="file"
                className="file-input-hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
              />
            </div>

            {file && (
              <div className="selected-file-pill">
                <FileCheck size={18} className="text-success" />
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="action-btn primary full-width" 
              disabled={!file || uploading}
              style={{ marginTop: '1.25rem' }}
            >
              {uploading ? 'Calculating Digest & Storing...' : 'Upload & Compute Hash'}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        {/* Uploaded Outcome */}
        <div className="glass-card">
          <h3>Cryptographic Artifact Metadata</h3>
          {uploadedDoc ? (
            <div className="artifact-details">
              <div className="detail-row">
                <span className="detail-label">Document ID</span>
                <span className="code-snippet">{uploadedDoc.documentId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Original Filename</span>
                <span>{uploadedDoc.originalFilename}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">MIME Type</span>
                <span>{uploadedDoc.mimeType}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">File Size</span>
                <span>{uploadedDoc.sizeBytes} bytes</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">SHA-256 Digest</span>
                <div className="hash-copy-row">
                  <span className="code-snippet hash-text">{uploadedDoc.sha256Hash}</span>
                  <button 
                    className="icon-action-btn" 
                    onClick={() => copyHash(uploadedDoc.sha256Hash)}
                    title="Copy SHA-256 Digest"
                  >
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div className="detail-row">
                <span className="detail-label">Local Path</span>
                <span className="text-muted text-xs">{uploadedDoc.localPath}</span>
              </div>

              <div className="artifact-actions-row" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                <button 
                  className="action-btn primary text-xs"
                  onClick={() => onNavigate('verify_document', { documentId: uploadedDoc.documentId, documentHash: uploadedDoc.sha256Hash })}
                >
                  Verify This Document
                </button>
                <button 
                  className="action-btn secondary text-xs"
                  onClick={() => onNavigate('document_analysis', { documentId: uploadedDoc.documentId })}
                >
                  <Cpu size={14} /> Run OCR & AI Analysis
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <FileCheck size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No document uploaded in this session.</p>
              <span className="text-muted text-xs">Upload a file on the left to inspect its deterministic SHA-256 cryptographic digest.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
