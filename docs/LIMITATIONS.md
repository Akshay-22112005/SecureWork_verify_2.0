# System Limitations & Boundary Constraints

## 1. Phase 0 Scope Limitations

As mandated by the Phase 0 specification:
* **No Authentication Logic**: User registration, login, and JWT issuance are stubbed boundaries and scheduled for Phase 1.
* **No Credential Issuance**: Cryptographic signing routines are defined, but persistent credential issuance is scheduled for Phase 2.
* **No Production OCR / ML Engine**: Tesseract and AI heuristic boundaries are established as clean interfaces for Phase 4.
* **Non-Blocking Standby Mode for MongoDB**: In development, the backend operates without requiring a cloud MongoDB instance. Database-dependent routes will remain stubs until Phase 1.

---

## 2. Cryptographic & Security Boundaries

1. **Local Key Custody**:
   * Storing private keys on local disk (`backend/keys/`) is suited for local development and self-hosted environments. Highly regulated enterprise environments will require a Hardware Security Module (HSM) or PKCS#11 adapter in future phases.
2. **Advisory Nature of OCR & AI**:
   * Computer vision cannot detect analog document fraud (e.g. forged physical paper certificates prior to high-resolution scanning) if the scan itself is clean and has no digital tampering traces. Official registry verification is the definitive backstop.
3. **Upstream Registry Availability**:
   * Offline verification depends strictly on cached revocation lists and public keys. If an upstream government registry undergoes an outage, Tier 2 corroboration will be queued until the registry resumes operations.
