import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Shield, Cpu, Lock, CheckCircle2 } from 'lucide-react';

const FAQ_ITEMS = [
  {
    id: 'faq-1',
    question: 'How does SecureWork Verify provide mathematical certainty without blockchain?',
    answer: 'SecureWork Verify leverages battle-tested asymmetric public-key cryptography (Ed25519 and RSA-PSS) coupled with RFC 8785 JSON Canonicalization Scheme (JCS). Issuers sign deterministic payloads with isolated private keys. Anyone with the issuer’s public key can instantly verify signatures mathematically in <15ms with zero network calls and zero gas fees.'
  },
  {
    id: 'faq-2',
    question: 'Can credentials be verified completely offline with zero internet access?',
    answer: 'Yes. SecureWork Verify exports standalone, portable Verification Bundles containing the canonical credential JSON, cryptographic signatures, issuer public key certificates, and Merkle audit chain proofs. Verification can be executed anywhere via the standalone CLI (`npm run verify:offline -- bundle.json`) using only standard Node.js crypto.'
  },
  {
    id: 'faq-3',
    question: 'How does the Tamper-Evident Audit Chain prevent forgery and backdating?',
    answer: 'Every issuance, verification, key rotation, and revocation event is committed to a cryptographic hash-linked ledger. Each block includes the SHA-256 hash of its predecessor, creating an unbroken Merkle DAG where any retroactive alteration invalidates all downstream blocks.'
  },
  {
    id: 'faq-4',
    question: 'What happens when an issuer key is rotated or revoked?',
    answer: 'SecureWork Verify maintains an immutable historical key registry. When keys are rotated according to NIST best practices, previously signed credentials remain verifiable against their valid validity-window timestamps without compromising current signing operations.'
  },
  {
    id: 'faq-5',
    question: 'Is SecureWork Verify compliant with privacy standards like GDPR and CCPA?',
    answer: 'Absolutely. Because SecureWork Verify does not publish personal data to immutable public blockchains, holder privacy is completely safeguarded. Public verification portals only expose consented qualification claims, and cryptographic signatures can verify validity without transmitting sensitive personally identifiable information (PII).'
  }
];

export default function FaqAccordion() {
  const [openId, setOpenId] = useState('faq-1');

  function toggleItem(id) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="faq-accordion-container" role="region" aria-label="Frequently Asked Questions">
      {FAQ_ITEMS.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div 
            key={item.id} 
            className={`faq-item ${isOpen ? 'open' : ''}`}
          >
            <button
              type="button"
              className="faq-question-btn"
              onClick={() => toggleItem(item.id)}
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${item.id}`}
              id={`faq-header-${item.id}`}
            >
              <span>{item.question}</span>
              <ChevronDown 
                size={18} 
                style={{ 
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform var(--transition-fast)',
                  color: isOpen ? 'var(--accent-indigo-light)' : 'var(--text-muted)',
                  flexShrink: 0
                }} 
              />
            </button>
            {isOpen && (
              <div 
                id={`faq-answer-${item.id}`}
                role="region"
                aria-labelledby={`faq-header-${item.id}`}
                className="faq-answer animate-fade-in-up"
              >
                <p>{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
