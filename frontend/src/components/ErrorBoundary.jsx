import React from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught component error in ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-screen" style={{
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '16px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          margin: '1.5rem',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            color: '#ef4444'
          }}>
            <AlertOctagon size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f8fafc' }}>
            Something went wrong rendering this view
          </h2>
          <p style={{ maxWidth: '480px', fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred in this module.'}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="action-btn primary text-xs"
              onClick={this.handleReset}
              style={{ padding: '8px 16px' }}
            >
              <RefreshCw size={14} /> Try Again
            </button>
            <button
              className="action-btn secondary text-xs"
              onClick={() => { window.location.href = '/dashboard'; }}
              style={{ padding: '8px 16px' }}
            >
              <Home size={14} /> Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
