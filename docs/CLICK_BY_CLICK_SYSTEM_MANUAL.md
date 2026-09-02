# SecureWork Verify — Complete Click-by-Click System Manual & Interaction Specification

This document provides a **complete, exhaustive, click-by-click breakdown** of every screen, navbar item, sidebar link, form field, button, modal, and background process across the **SecureWork Verify** platform.

---

## 1. System Navigation Architecture & Routing Engine

The web application uses a high-performance single-page application (SPA) state router orchestrated in `frontend/src/App.jsx` via `handleNavigate(pageId, params)`. 

### State Routing Dispatch Table
| Internal `pageId` | Component | Required Role(s) | Default Visual View |
|:---|:---|:---|:---|
| `login` | `Login.jsx` | Public | Auth card with email/password inputs |
| `register` | `Register.jsx` | Public | User onboarding form with role selection |
| `dashboard` | `UserDashboard.jsx` | All Authenticated | 4 live metric cards, quick actions, verification table |
| `upload_document` | `UploadDocument.jsx` | `USER`, `ADMIN` | File dropzone & Cryptographic Artifact panel |
| `verify_document` | `VerifyDocument.jsx` | `USER`, `ADMIN` | 3-field query form, 16-gate verification card |
| `verification_history` | `VerificationHistory.jsx` | `USER`, `ADMIN` | Chronological verification logs with search & status filters |
| `my_credentials` | `MyCredentials.jsx` | `USER`, `ADMIN` | Personal qualification portfolio with download & verify buttons |
| `document_analysis` | `DocumentAnalysis.jsx` | `USER`, `ADMIN` | OCR extraction panel & AI tampering anomaly inspector |
| `issuer_status` | `IssuerStatus.jsx` | `ISSUER`, `ADMIN`, `USER` | Issuer accreditation profile details & onboarding request form |
| `issue_credential` | `IssueCredential.jsx` | `ISSUER`, `ADMIN` | 6-field canonical issuance form with Ed25519 signing |
| `credential_list` | `CredentialList.jsx` | `ISSUER`, `ADMIN` | Credential inventory with Revoke, Revision (v2), and Timeline modals |
| `key_status` | `KeyStatus.jsx` | `ISSUER`, `ADMIN` | SPKI public key display, Key Rotation, Compromise Flagging |
| `hr_verify` | `VerifyDocument.jsx` | `HR`, `ADMIN` | Verifier-tailored multi-check credential inspection |
| `verify_source` | `VerifyOfficialSource.jsx` | `HR`, `ADMIN` | External registry adapter query engine (`SOURCE_VERIFIED`) |
| `hr_history` | `VerificationHistory.jsx` | `HR`, `ADMIN` | Audit log of candidate verifications |
| `audit_logs` | `AuditLogs.jsx` | `AUDITOR`, `ADMIN` | SHA-256 hash-chained block sequence explorer with JSON export |
| `verification_evidence` | `VerificationEvidence.jsx` | `AUDITOR`, `ADMIN` | Self-contained cryptographic evidence package viewer |
| `chain_validation` | `AuditChainValidation.jsx` | `AUDITOR`, `ADMIN` | Genesis-to-head cryptographic chain validation & anchor tool |
| `admin_users` | `AdminUsers.jsx` | `ADMIN` | Platform user directory with real-time RBAC role editor |
| `admin_organizations` | `AdminOrganizations.jsx` | `ADMIN` | Accreditation registry with Approve, Suspend, Revoke controls |
| `admin_trusted_sources`| `AdminTrustedSources.jsx` | `ADMIN` | SSRF-safe official registry endpoints & state toggles |
| `admin_issuers` | `AdminIssuers.jsx` | `ADMIN` | Review pending issuer applications & Ed25519 key generation |
| `admin_settings` | `AdminSystemSettings.jsx` | `ADMIN` | Node.js process telemetry, MongoDB status, engine driver flags |

---

## 2. Global Navbar & Header Controls

The top navigation bar is rendered persistently by `frontend/src/components/Navbar.jsx`.

### 2.1 Brand Logo & Home Redirect
- **Visual Element**: Shield icon badge and text *"SecureWork Verify — v1.0 Production"*.
- **Click Event**: Executes `onNavigate('dashboard')`.
- **Where It Goes**: Resets active view to `UserDashboard.jsx`.
- **Backend Calls**: None (client-side state navigation).

---

### 2.2 Persona Quick-Switcher Buttons
Located in the top right cluster to enable instant switching between system roles for demonstration:

#### A. The `ADMIN` Pill Button
- **Click Event**: Invokes `handleQuickSwitch({ role: 'ADMIN', email: 'admin@securework.local' })`.
- **Backend API Call**: `POST /api/auth/login` with `{"email": "admin@securework.local", "password": "Admin12345!"}`.
- **Backend Action**: Validates bcrypt password hash; verifies `role === 'ADMIN'`; issues fresh JWT token signed with `JWT_SECRET`.
- **Frontend Action**: Updates `AuthContext`: sets `user` state, stores token in `localStorage.setItem('sw_auth_token', token)`.
- **UI Transformation**: The sidebar re-renders to reveal all 6 sections (General, User, Issuer Management, HR, Auditor, and Administration). Active persona pill changes color to high-contrast cyan.

#### B. The `AUDITOR` Pill Button
- **Click Event**: Executes `handleQuickSwitch` for `auditor@securework.local`.
- **Backend API Call**: `POST /api/auth/login`.
- **UI Transformation**: Unlocks the **Auditor & Compliance** section in the sidebar. Hides administrative configuration menus.

#### C. The `ISSUER` Pill Button
- **Click Event**: Authenticates as an accredited institutional authority (e.g. `issuer_auth@stanford.edu`).
- **UI Transformation**: Unlocks the **Issuer Management** section (Issue Credential, Key Status, Credential List).

#### D. The `HR` Pill Button
- **Click Event**: Authenticates as corporate recruiter/verifier (`HR`).
- **UI Transformation**: Unlocks **HR / Verifier** menus (Verify Candidate, Verify Official Source).

#### E. The `USER` Pill Button
- **Click Event**: Authenticates as standard credential holder/worker.
- **UI Transformation**: Restricts sidebar view strictly to **User / Credential Holder** (Upload, My Credentials, History).

---

### 2.3 Notifications Bell & Drawer Trigger
- **Visual Element**: Bell icon with red pill counter (`unreadCount`).
- **Click Event**: Triggers `toggleDrawer()` from `NotificationContext`.
- **What It Does**: Slides open the **Notification Drawer** (`frontend/src/components/NotificationDrawer.jsx`) from the right edge of the screen.
- **Inside the Drawer**:
  - Displays chronological in-app alerts (e.g., *"Credential Issued"*, *"Verification Altered"*, *"Issuer Approved"*).
  - **"Mark All as Read" Button**:
    - **Backend Call**: `PATCH /api/notifications/mark-all-read`.
    - **Backend Action**: Sets `isRead: true` across all notifications for the active user.
    - **UI Result**: Clears unread badge count to `0`.
  - **"Close Drawer" Button (`X` Icon)**: Closes the sliding panel.

---

### 2.4 Logout Button
- **Visual Element**: Rectangular user badge showing active name and role next to a `LogOut` icon.
- **Click Event**: Invokes `logout()` in `AuthContext`.
- **What It Does**: Removes `sw_auth_token` and `sw_user_profile` from browser `localStorage`, clears in-memory state, and redirects viewport to `Login.jsx`.

---

## 3. General Section: Dashboard Screen

Located at `frontend/src/pages/UserDashboard.jsx`.

### 3.1 Top Header & Refresh
- **"Refresh" Button (`RefreshCw` Icon)**:
  - **Click Event**: Invokes `loadDashboardData()`.
  - **Backend Calls**:
    1. `GET /api/health`: Polls backend and MongoDB uptime.
    2. `GET /api/credentials?limit=5`: Fetches user's latest credentials.
    3. `GET /api/verifications?limit=5`: Fetches recent verification jobs.
    4. `GET /api/audit-logs?limit=1`: Fetches total sequence height.
  - **UI Result**: Re-animates metric counters and refreshes the recent activity table.

---

### 3.2 Live Metrics Grid Cards
1. **Total Credentials Card**: Shows total active credentials in database.
2. **Verification Operations Card**: Shows total multi-gate verifications evaluated.
3. **Active Issuers Card**: Shows number of approved issuing authorities.
4. **Audit Chain Height Card**: Displays current immutable sequence count (e.g., `#105 Genesis Links`).

---

### 3.3 Quick Action Action Cards
- **"Upload Document" Action Card**: Clicking redirects user directly to `UploadDocument.jsx`.
- **"Verify Document" Action Card**: Clicking redirects user directly to `VerifyDocument.jsx`.
- **"Issue Credential" Action Card**: Clicking redirects user directly to `IssueCredential.jsx`.
- **"Validate Hash Chain" Action Card**: Clicking redirects user directly to `AuditChainValidation.jsx`.

---

### 3.4 Recent Verifications Table
- Displays last 5 evaluation records: Target Credential, Verifier Role, Outcome Badge (`LEVEL 5 CURRENTLY_VALID`, `ALTERED`, etc.), Timestamp.
- **"Inspect" Button on Row**:
  - **Click Event**: Invokes `onNavigate('verify_document', { credentialId, documentHash })`.
  - **Where It Goes**: Opens `VerifyDocument.jsx` pre-filled with the exact parameters of that row and automatically evaluates the verification pipeline.

---

## 4. User / Credential Holder Section

---

### 4.1 Upload Document Screen (`UploadDocument.jsx`)

#### A. File Dropzone Box
- **Dropzone Area**: Drag and drop any file or click inside the dashed perimeter.
- **Click Event**: Opens system native file explorer.
- **Client Validation**:
  - If user selects file > 10 MB: Discards file and renders red alert: *"File exceeds maximum size limit of 10 MB."*
  - Supported extensions: `.pdf`, `.png`, `.jpg`, `.jpeg`.
- **Selected File Pill**: Displays file name, byte size, and green checkmark.

#### B. "Upload & Compute Hash" Button
- **Click Event**: Executes `handleUpload(e)`.
- **Frontend Action**: Creates `FormData`, appends `formData.append('file', file)`.
- **Backend API Call**: `POST /api/documents/upload`.
- **Backend Processing**:
  1. `Multer` buffers file into memory.
  2. `fileValidator.js` validates magic bytes (`%PDF-1.5`, `\x89PNG`, `\xFF\xD8\xFF`).
  3. Computes raw binary SHA-256 hash.
  4. Saves file to disk at `backend/storage/documents/<sha256Hash>.<ext>`.
  5. Inserts record into MongoDB `Documents` collection with `uploadedBy: req.user.userId`.
  6. Creates chained audit record `DOCUMENT_INGESTED`.
- **UI Result**:
  - The right column transforms to show **Cryptographic Artifact Metadata**:
    - **Document ID**: Unique reference (e.g., `doc_8fb98db8205b7891`).
    - **Authoritative SHA-256 Hash**: 64-character hexadecimal digest.
    - **MIME Type & Byte Size**.
- **Copy Hash Button (`Copy` Icon)**:
  - **Click Event**: Invokes `navigator.clipboard.writeText(sha256Hash)`.
  - **UI Result**: Icon temporarily switches to a green `Check` icon and displays *"Copied to clipboard!"*.

---

### 4.2 Verify Document Screen (`VerifyDocument.jsx`)

#### A. Query Parameters Form
- **Credential ID Input**: Type or paste `crd_...`.
- **Document SHA-256 Hash Input**: Type or paste 64-character hash.
- **Document Artifact ID Input (Optional)**: Type or paste `doc_...`.

#### B. "Evaluate Cryptographic Verification" Button
- **Click Event**: Executes `handleVerify(e)`.
- **Frontend Action**: Checks that at least Credential ID or Hash is present; activates loading spinner.
- **Backend API Call**: `POST /api/verifications/evaluate` with `{ credentialId, documentHash, documentId }`.
- **Backend Processing**:
  - Passes request to `verificationEngine.js` which executes all **16 discrete verification gates**:
    1. `credentialExistence`: Finds credential in MongoDB.
    2. `versionExistence`: Checks version lineage.
    3. `organizationTrust`: Asserts sponsoring organization is `VERIFIED`.
    4. `issuerAuthorization`: Asserts issuer profile is `ACTIVE`.
    5. `issuerKeyStatus`: Fetches SPKI public key; verifies key is not compromised.
    6. `documentIntegrity`: Computes timing-safe hash comparison (`crypto.timingSafeEqual`).
    7. `digitalSignature`: Rebuilds RFC 8785 canonical JSON; executes Ed25519 mathematical verification (`crypto.verify`).
    8. `recipientBinding`: Checks user binding.
    9. `expiration`: Checks temporal validity against current timestamp.
    10. `revocation`: Asserts absence from revocation registry.
    11. `conflicts`: Detects cross-source discrepancies.
  - Synthesizes findings into one of **6 Trust Levels** (Level 0 `UNKNOWN` to Level 5 `CURRENTLY_VALID`).
  - Appends audit event `VERIFICATION_EVALUATED` to cryptographic hash chain.
- **UI Result**: Renders the **Trust Evidence Card**:
  - Prominent status banner with color coding (Green for `VERIFIED`, Red for `ALTERED`, Orange for `EXPIRED` or `REVOKED`).
  - Trust level readout (e.g. `LEVEL 5 CURRENTLY_VALID`).
  - 16 interactive check accordions showing passed/failed criteria.
  - Issuer public key fingerprint and cryptographic evaluation timestamp.

#### C. Manual Review Submission Box (Auditor / Admin / HR)
- If verification is flagged or pending manual review, this box appears:
- **Decision Dropdown**: Select `CONFIRMED` or `REJECTED`.
- **Notes Field**: Type reason for manual decision.
- **"Submit Manual Review Decision" Button**:
  - **Backend Call**: `POST /api/verifications/:id/manual-review`.
  - **Backend Action**: Updates `humanVerificationStatus`; recalculates final verification result; records `VERIFICATION_MANUALLY_REVIEWED` in audit chain.
  - **UI Result**: Displays green banner *"Manual review submitted and hash-chained to audit log"*.

---

### 4.3 Verification History Screen (`VerificationHistory.jsx`)
- **Search Input Field**: Live filters list by Credential ID or Candidate ID.
- **Status Filter Dropdown**: Filter by `ALL`, `VERIFIED`, `ALTERED`, `CREDENTIAL_EXPIRED`, `CREDENTIAL_REVOKED`.
- **"Refresh" Button**: Refreshes list from `GET /api/verifications`.
- **"View Evidence" Link Button**: Navigates to `VerificationEvidence.jsx` for that verification.

---

### 4.4 My Credentials Screen (`MyCredentials.jsx`)
- **Credential Cards**: Displays all qualifications awarded to the active user.
- **"Copy Credential ID" Button**: Copies `crd_...` ID.
- **"Download Document" Button**:
  - **Backend Call**: `GET /api/documents/:id/download`.
  - **Backend Action**: Checks document access permissions; streams raw binary file matching original SHA-256.
  - **UI Result**: Triggers browser file download.
- **"Verify This Credential" Button**:
  - **Click Event**: Calls `onNavigate('verify_document', { credentialId: cred.credentialId })`.
  - **Where It Goes**: Redirects directly to `VerifyDocument.jsx` and runs the verification.

---

### 4.5 Document Analysis - OCR & AI Screen (`DocumentAnalysis.jsx`)

#### A. Document ID Input Field
- Enter target `doc_...` ID.

#### B. "Run Local OCR" Button
- **Click Event**: Executes `handleRunOcr(e)`.
- **Backend API Call**: `POST /api/analysis/ocr` with `{"documentId": "doc_..."}`.
- **Backend Processing**:
  - Retrieves document binary from local storage.
  - Passes buffer into local Tesseract.js worker thread.
  - Parses text into structured fields (Candidate Name, Organization, Conformance Date).
  - Saves result in MongoDB `OCRAnalyses` collection.
  - Appends audit event `OCR_ANALYSIS_PERFORMED`.
- **UI Result**: Renders extracted text block, confidence percentage badge (e.g. `95.0% Confidence`), and parsed field tokens.

#### C. "Run AI Security Analysis" Button
- **Click Event**: Executes `handleRunAi(e)`.
- **Backend API Call**: `POST /api/analysis/document` with `{"documentId": "doc_..."}`.
- **Backend Processing**:
  - Scans image for font inconsistencies, edge noise artifacts, and metadata splicing.
  - Generates anomaly score and risk categorization (`LOW`, `MEDIUM`, `HIGH`).
  - Records advisory report in `AIAnalyses` collection.
- **UI Result**: Displays anomaly gauge, visual risk classification, and advisory warnings.

---

## 5. Issuer Management Section

---

### 5.1 Issuer Status Screen (`IssuerStatus.jsx`)
- **Status Header**: Displays active organization and current status badge (`PENDING`, `ACTIVE`, `SUSPENDED`, `REVOKED`).
- **"Register As Issuer" Form (When not yet an approved issuer)**:
  - **Select Organization Dropdown**: Choose from verified organizations.
  - **Issuer Code Input**: Unique identifier (e.g. `DEAN_ENG_2026`).
  - **Job Title Input**: e.g. *"Dean of Engineering"*.
  - **Appointment Resolution Input**: Council / Board legal resolution.
  - **Contact Phone Input**: Institutional phone number.
  - **"Submit Issuer Request" Button**:
    - **Backend API Call**: `POST /api/issuers/register`.
    - **Backend Action**: Creates `Issuers` document with `status: 'PENDING'`. Audit event `ISSUER_REGISTERED` recorded.
    - **UI Result**: Displays message *"Issuer request submitted. Awaiting administrative approval."*

---

### 5.2 Issue Credential Screen (`IssueCredential.jsx`)

#### A. The Credential Form
- **Issuer Profile Dropdown**: Selects active issuer profile.
- **Recipient User ID Field**: Enter recipient `usr_...` ID.
- **Document Artifact ID Field**: Enter uploaded `doc_...` ID.
- **Credential Type Dropdown**: `DEGREE`, `LICENSE`, `CERTIFICATION`, `EMPLOYMENT`.
- **Credential Title Field**: e.g. *"Bachelor of Science in Computer Science"*.
- **Validity Period (Days) Field**: Defaults to `730` (2 years). Setting `0` creates perpetual qualification.

#### B. "Issue Signed Credential" Button
- **Click Event**: Executes `handleIssue(e)`.
- **Backend API Call**: `POST /api/credentials/issue`.
- **Backend Processing**:
  1. Asserts issuer is `ACTIVE` and organization is `VERIFIED`.
  2. Resolves issuer's active Ed25519 keypair.
  3. Formulates 9-field RFC 8785 canonical JSON payload.
  4. Decrypts/retrieves Ed25519 private key from `backend/keys/<keyId>.key`.
  5. Computes Ed25519 digital signature.
  6. Saves credential into `Credentials` and `CredentialVersions` collections.
  7. Emits `CREDENTIAL_ISSUED` event to the hash-chained audit ledger.
  8. Dispatches in-app notification to the recipient user.
- **UI Result**: Displays green confirmation card with:
  - **Assigned Credential ID** (`crd_...`).
  - **Base64 Signature Digest Snippet**.
  - **"Copy Credential ID"** button.

---

### 5.3 Credential List Screen (`CredentialList.jsx`)
- **Tabs**: `ALL`, `ACTIVE`, `REVOKED`, `EXPIRED`.
- **"Revoke" Button on Row**:
  - Opens Revocation Modal.
  - **Reason Dropdown**: `DISCIPLINARY_ACTION`, `ISSUED_IN_ERROR`, `ADMINISTRATIVE_CANCELLATION`.
  - **Notes Textarea**: Enter required explanation.
  - **"Confirm Revocation" Button**:
    - **Backend Call**: `PATCH /api/credentials/:id/revoke`.
    - **Backend Action**: Updates credential state to `REVOKED`; creates audit event `CREDENTIAL_REVOKED`.
    - **UI Result**: Credential row status immediately updates to red `REVOKED` badge.
- **"New Version" Button on Row**:
  - Opens Revision Modal (to issue `v2` or `v3`).
  - Allows selecting a new Document ID or updating Title.
  - **"Issue Revision" Button**:
    - **Backend Call**: `POST /api/credentials/:id/versions`.
    - **Backend Action**: Creates new `CredentialVersion`; signs with active Ed25519 key; supersedes previous version.
- **"Timeline" Button on Row**:
  - Opens chronological modal showing full history of issuances, revisions, verifications, and status transitions.

---

### 5.4 Cryptographic Key Status Screen (`KeyStatus.jsx`)
- **Key Cards**: Displays SPKI Public Key for each keypair owned by the issuer.
- **Algorithm Badge**: Shows `ED25519`.
- **Key Fingerprint**: First 16 characters of SHA-256 over public key PEM.
- **"Copy Public Key" Button**: Copies SPKI PEM to clipboard.
- **"Rotate Key" Button**:
  - Prompts user for confirmation.
  - **Backend Call**: `POST /api/issuers/:id/rotate-key`.
  - **Backend Action**: Transitions active key to `RETIRED`; generates new Ed25519 keypair on filesystem; sets new key to `ACTIVE`.
  - **UI Result**: Key list updates showing new active key and retired historical key.
- **"Mark Compromised" Button**:
  - Prompts for compromise timestamp.
  - **Backend Call**: `PATCH /api/issuer-keys/:id/compromise`.
  - **Backend Action**: Marks key `COMPROMISED`. Verification engine will flag any credentials issued after that timestamp.

---

## 6. HR / Verifier Section

---

### 6.1 Verify Official Source Screen (`VerifyOfficialSource.jsx`)
- **Accredited Registry Dropdown**: Select official source (e.g. *Higher Education Degree Verification Registry* or *State Licensing Board*).
- **Subject Query Identifier Input**: Enter candidate registration ID (e.g. `REG_CAMFORD_88219`).
- **"Query Official Source" Button**:
  - **Backend API Call**: `POST /api/verifications/verify-source`.
  - **Backend Action**: Executes the `LocalSourceVerificationAdapter` (or external registry driver).
  - **UI Result**: Displays the Source Verification Card:
    - **Status**: `SOURCE_VERIFIED` (cryptographically confirmed by registry) or `SOURCE_FOUND` (confirmed in registry database without cryptographic proof).
    - **Registry SHA-256 Response Digest**.
    - Official verification timestamp and audit reference.

---

## 7. Auditor & Compliance Section

---

### 7.1 Hash-Chained Audit Logs Screen (`AuditLogs.jsx`)
- **Live Sequence Explorer Table**:
  - Lists block sequences: Sequence Number (`#0`, `#1`, `#2`...), Timestamp, Actor ID, Actor Role, Action Name (`CREDENTIAL_ISSUED`, `KEY_ROTATED`, etc.), and Current Hash.
- **"Inspect Entry" Button (`Chevron` Icon)**:
  - Expands table row to show:
    - `previousHash`: Hash of predecessor record.
    - `currentHash`: Deterministic hash of current record.
    - Full RFC 8785 canonical metadata payload.
- **"Export Audit Trail" Button**:
  - Generates and downloads `audit_trail_export.json` formatted for external regulatory or legal compliance.

---

### 7.2 Verification Evidence Screen (`VerificationEvidence.jsx`)
- **Verification ID Input Field**: Enter `vrf_...` ID.
- **"Fetch Complete Evidence Package" Button**:
  - **Backend Call**: `GET /api/verifications/:id/evidence`.
  - **UI Result**: Renders the complete, self-contained Evidence Envelope:
    - Canonical Credential JSON representation.
    - Ed25519 Digital Signature.
    - Exact SPKI Public Key Certificate active at signing time.
    - Audit Trail Sequence Number.
    - Offline verification instruction string.

---

### 7.3 Audit Chain Validation Screen (`AuditChainValidation.jsx`)

#### A. Top Action Buttons
- **"Run Validation" Button (`RefreshCw` Icon)**:
  - **Click Event**: Executes `runValidation()`.
  - **Backend API Call**: `GET /api/audit-logs/validate`.
  - **Backend Processing**:
    - Queries all audit records sorted by `sequenceNumber: 1`.
    - Computes Genesis verification: asserts Sequence #0 `previousHash` equals `SHA256("GENESIS_SECUREWORK_VERIFY")`.
    - Iterates sequentially, re-computing:
      $$\text{SHA256}(\text{previousHash} \parallel \text{seq} \parallel \text{timestamp} \parallel \text{actorId} \parallel \text{action} \parallel \text{JCS}(\text{metadata}))$$
    - Compares re-computed hash against stored `currentHash`.
  - **UI Result**:
    - **Clean State**: Renders large green shield banner:
      **"CRYPTOGRAPHICALLY VALID: All N audit records verified from Genesis"**.
    - **Tampered State**: Renders large red alert banner:
      **"TAMPERING DETECTED at Sequence #X: Stored hash diverges from computed hash"**.
- **"Anchor Checkpoint" Button (`Anchor` Icon)**:
  - **Backend Call**: `POST /api/audit-logs/checkpoints`.
  - **Backend Action**: Creates an immutable internal anchor record over the current chain head hash.
  - **UI Result**: Appends new checkpoint card to the Anchor Checkpoints list.

---

## 8. Administration Section

---

### 8.1 User Directory & RBAC Screen (`AdminUsers.jsx`)
- **Users Table**: Displays all platform users with User ID, Name, Email, Role badge, Status.
- **Role Selector Dropdown**: Select `ADMIN`, `ISSUER`, `HR`, `AUDITOR`, or `USER`.
- **"Save Role" Button (`Check` Icon)**:
  - **Backend Call**: `PATCH /api/users/:id/role` with `{"role": newRole}`.
  - **Backend Action**: Validates administrative privilege; updates role in MongoDB; writes audit event `USER_ROLE_UPDATED`.
  - **UI Result**: User role badge updates immediately.

---

### 8.2 Organizations & Trust Screen (`AdminOrganizations.jsx`)

#### A. "Register New Organization" Button (`Plus` Icon)
- Opens Registration Modal:
  - `Organization Name`: e.g. *"Camford University of Technology"*.
  - `Organization Code`: e.g. *"CAMFORD_TECH"*.
  - `Official Domain`: e.g. *"camford.ac.uk"*.
  - `Organization Type`: `UNIVERSITY`, `ENTERPRISE`, `GOVERNMENT_AGENCY`.
- **"Create Organization" Button in Modal**:
  - **Backend Call**: `POST /api/organizations`.
  - **UI Result**: Appends organization in `PENDING` state to directory.

#### B. Organization Table Action Buttons
- **"Approve & Verify" Button**:
  - **Backend Call**: `PATCH /api/organizations/:id/verify`.
  - **Backend Action**: Sets `organizationVerificationStatus: 'VERIFIED'`; records audit event `ORGANIZATION_VERIFIED`.
  - **UI Result**: Organization badge changes to green `VERIFIED`. Sponsoring issuers can now be approved.
- **"Suspend" Button**:
  - Prompts for reason; sets status to `SUSPENDED`.
- **"Revoke" Button**:
  - Prompts for confirmation; sets status to `REVOKED`; automatically cascades revocation to all member issuers.

---

### 8.3 Trusted Sources Screen (`AdminTrustedSources.jsx`)
- **"Add Trusted Source" Button**:
  - Opens registration modal for official registry URLs.
  - Validates against SSRF (Server-Side Request Forgery) attacks by verifying IP ranges and domain whitelists.
- **"Toggle Source State" Button**:
  - Enables or disables querying of that registry during verification evaluations.

---

### 8.4 Issuer Accreditation Screen (`AdminIssuers.jsx`)
- **Pending Issuer Applications Table**:
  - Lists applicant user names, bound organization, official job title, and legal appointment resolution notes.
- **"Approve Accreditation" Button**:
  - **Backend API Call**: `PATCH /api/issuers/:id/approve`.
  - **Backend Processing**:
    1. Sets issuer profile to `ACTIVE`.
    2. Promotes applicant user account from `USER` to `ISSUER`.
    3. Triggers `issuerKeyService.generateKeyPair()` to automatically generate an Ed25519 keypair.
    4. Writes `ISSUER_APPROVED` event to audit chain.
    5. Sends in-app notification to applicant.
  - **UI Result**: Card moves from Pending to Approved Issuers; applicant can now issue credentials.
- **"Reject" Button**:
  - Sets issuer status to `REJECTED` and sends notification with feedback.

---

### 8.5 System Health & Settings Screen (`AdminSystemSettings.jsx`)
- **Telemetry Indicators**:
  - Node.js Runtime Version (e.g. `v22.21.0`).
  - Operating System Platform (`win32`).
  - Active Memory Usage (MB).
  - Server Uptime counter.
- **Database Status Indicator**:
  - Displays `CONNECTED` (Green dot), Host (`127.0.0.1`), and Active Database (`securework_verify`).
- **Feature Flag Indicators**:
  - `OCR_ENABLED`: Shows `true` (Tesseract.js Local).
  - `AI_ENABLED`: Shows `true` (Local Tampering Heuristics).
- **"Reload Configuration" Button**:
  - Re-checks environment variables and re-queries `/api/health`.
