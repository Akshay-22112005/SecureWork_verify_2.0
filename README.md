# SecureWork Verify

> **A Cryptographically Verifiable Workforce Credential & Qualification Verification Platform**

SecureWork Verify is an enterprise-grade platform engineered to verify employment credentials, professional licenses, training certificates, and identity claims with mathematical certainty. Built on modern public-key cryptography and tamper-evident audit chains, SecureWork Verify delivers zero-trust offline verification without relying on costly third-party verification SaaS, proprietary blockchain networks, or cloud vendor lock-in.

---

## Architecture Overview

SecureWork Verify is constructed as a **Modular Monolith**:
- **Single Process Execution**: Runs as a unified backend runtime for ultra-fast local development and simplified single-node deployment.
- **Strict Domain Boundaries**: Business modules (`auth`, `issuers`, `credentials`, `verification`, `trust`, `ocr`, `audit`, etc.) maintain clean boundaries and isolated responsibilities.
- **Microservices Ready**: Module interfaces are designed with clean input/output contracts, making future extraction into distributed microservices seamless without domain rewrites.
- **Decoupled Frontend**: A modern, lightweight Single Page Application (SPA) powered by React and Vite that interacts with the backend over standardized REST APIs.

---

## Core Engineering Principles

1. **Evidence First**: No credential status can be marked verified without immutable cryptographic or registry-backed evidence.
2. **Zero-Cost Principle**: Pure open-source stack. Uses native Node.js cryptographic APIs (`crypto`), local storage adapters, and open-source OCR heuristics. No paid SaaS subscriptions required.
3. **No Blockchain**: Uses battle-tested asymmetric cryptography (Ed25519, ECDSA, RSA), deterministic canonicalization (RFC 8785 JCS), and cryptographic hash-linked audit chains. Delivers sub-second verifications with zero gas fees and full privacy compliance.
4. **Advisory AI / OCR**: Machine learning and OCR extraction assist human workflows but never override cryptographic proofs.
5. **Private Key Protection**: Private keys are strictly isolated in secure local vaults and never exposed over APIs or committed to version control.

See [PROJECT_RULES.md](./PROJECT_RULES.md) for full engineering specifications.

---

## Repository Structure

```
SecureWork-Verify/
├── backend/                  # Node.js & Express Modular Monolith
│   ├── src/
│   │   ├── config/           # Database and environment configurations
│   │   ├── middleware/       # Error handling, security, and logging middleware
│   │   ├── routes/           # REST route definitions
│   │   ├── controllers/      # Request handlers & response formatting
│   │   ├── services/         # Isolated domain business logic modules
│   │   ├── models/           # Data models (Mongoose schemas)
│   │   ├── adapters/         # Storage, OCR, and external source adapters
│   │   ├── utils/            # Cryptographic helpers, canonicalizer, logger
│   │   ├── validators/       # Input validation schemas
│   │   ├── app.js            # Express application configuration
│   │   └── server.js         # Server entry point & lifecycle management
│   ├── keys/                 # Local private/public key storage (git-ignored)
│   ├── storage/              # Document and temporary upload storage (git-ignored)
│   │   ├── documents/
│   │   └── temp/
│   ├── tests/                # Backend unit and integration tests
│   ├── .env.example          # Environment template
│   └── package.json
│
├── frontend/                 # React & Vite Frontend Single-Page App
│   ├── src/
│   │   ├── components/       # Reusable UI component library
│   │   ├── pages/            # View pages and verification workflows
│   │   ├── layouts/          # Shell, header, navigation layouts
│   │   ├── services/         # API client & HTTP transport
│   │   ├── hooks/            # Custom React hooks
│   │   ├── context/          # State management contexts
│   │   ├── utils/            # UI formatting & client-side helpers
│   │   ├── App.jsx           # Root application component
│   │   ├── index.css         # Design system tokens and styles
│   │   └── main.jsx          # DOM mount
│   ├── public/               # Static assets
│   ├── .env.example          # Frontend environment template
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── docs/                     # Comprehensive Architecture & Specification Suite
│   ├── ARCHITECTURE.md
│   ├── TRUST_MODEL.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SECURITY.md
│   ├── CRYPTOGRAPHY.md
│   ├── VERIFICATION.md
│   ├── OCR.md
│   ├── AI_ML.md
│   ├── OFFICIAL_SOURCE_VERIFICATION.md
│   ├── AUDIT.md
│   ├── DEPLOYMENT.md
│   ├── SCALABILITY.md
│   ├── TESTING.md
│   ├── DEMO.md
│   └── LIMITATIONS.md
│
├── scripts/                  # Automated verification and tooling scripts
│   └── verify-foundation.js
├── tests/                    # Monorepo cross-boundary smoke tests
├── .gitignore                # High-security exclusion rules
├── package.json              # Monorepo root workspace configuration
├── PROJECT_RULES.md          # Architectural and engineering rules
└── README.md                 # Project guide
```

---

## Local Development Requirements

- **Node.js**: `v18.0.0` or higher (tested on Node v22+)
- **npm**: `v9.0.0` or higher
- **MongoDB**: (Optional for Phase 0) Local MongoDB instance (`mongodb://localhost:27017/securework_verify`). The backend starts gracefully even if MongoDB is offline, reporting database status through health checks.

---

## Quick Start

### 1. Clone & Install Dependencies
```bash
# From the repository root:
npm install
```
This automatically installs dependencies across the root, `backend/`, and `frontend/` workspaces.

### 2. Environment Configuration
Create the local environment files from the provided examples:
```bash
# Backend environment
cp backend/.env.example backend/.env

# Frontend environment
cp frontend/.env.example frontend/.env
```

### 3. Run Development Servers
```bash
# Run both Backend (Port 5000) and Frontend (Port 5173) concurrently:
npm run dev

# Or run separately:
npm run dev:backend
npm run dev:frontend
```

### 4. Verify Foundation
Run the automated foundation verification script:
```bash
npm run verify
```

---

## Health Check API

Once the backend is started, test the health check endpoint:

```bash
curl http://localhost:5000/api/health
```

Sample Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-08-30T10:20:00.000Z",
    "uptime": 12.45,
    "environment": "development",
    "database": {
      "status": "disconnected",
      "host": "localhost"
    },
    "version": "0.1.0"
  }
}
```

---

## Modular Monolith & Extraction Path

Each domain module in `backend/src/services/` encapsulates its logic:
- **`auth`**: Authentication, token issuance, session control.
- **`users`**: User identity and profile management.
- **`organizations`**: Multi-tenant organizational units.
- **`issuers` & `issuerKeys`**: Public-key registry, key lifecycle management, key rollover.
- **`documents` & `storage`**: Tamper-proof document hashing and storage abstraction.
- **`credentials`**: Verifiable credential schema validation and issuance.
- **`verification`**: Multi-phase verification engine (signature, schema, revocation, trust).
- **`trust` & `trustedSources`**: Trust registry, white-lists, and authoritative official registries.
- **`ocr` & `ai`**: Optical character recognition extraction and document tampering heuristics.
- **`evidence` & `audit`**: Evidence package assembly and hash-linked audit trails.
- **`notifications`**: Transactional notifications and verification status webhooks.

When ready to scale horizontally, any module can be separated into an independent service with its own data store and gRPC/REST interface with no structural changes required to the domain algorithms.

---

## License

Confidential & Proprietary. All Rights Reserved.
