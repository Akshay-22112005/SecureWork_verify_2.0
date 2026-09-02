# SecureWork Verify — Complete UI Section & Button Guide

This guide breaks down **every single page, section, form, button, and interaction** across the entire **SecureWork Verify** web application, explaining exactly what each button triggers, how the backend processes it, and how to verify it.

---

## 1. Global Navigation & Top Bar

Located persistently at the top of the application viewport:

### 1.1 Brand Logo
- **Element**: Brand Shield Icon & `SecureWork Verify` text.
- **Action / Behavior**: Clicking anywhere on the brand logo navigates back to the **Dashboard (`UserDashboard`)**.

### 1.2 Persona Quick-Switcher (Pills)
Located in the top right cluster of the navbar for seamless testing and demonstration without tedious manual logouts:
- **`ADMIN` Button**: Logs in as `admin@securework.local` with administrative credentials. Unlocks all 5 navigation sections.
- **`AUDITOR` Button**: Switches active session to compliance officer role (`AUDITOR`). Unlocks audit logs, evidence packages, and cryptographic hash chain verification.
- **`ISSUER` Button**: Switches active session to accredited institution authority (`ISSUER`). Unlocks credential issuance, version management, and key status.
- **`HR` Button**: Switches active session to corporate screener/recruiter (`HR`). Unlocks document verification and official registry queries.
- **`USER` Button**: Switches active session to standard worker/credential holder (`USER`). Focuses view on uploading documents and viewing personal credentials.

### 1.3 Notifications Bell Icon
- **Element**: Bell icon with live unread badge count.
- **Action**: Opens the **In-App Notification Drawer** displaying real-time alert events (e.g. *"Credential Issued"*, *"Verification Altered"*, *"Organization Verified"*).

### 1.4 Profile & Logout
- **User Pill**: Displays active user name and assigned role badge.
- **Logout Button (`LogOut` icon)**: Clears the JWT session token from browser local storage and redirects to the **Login** screen.

---

## 2. General Section

### 2.1 Dashboard (`UserDashboard.jsx`)
- **Metric Cards**:
  - **Total Credentials**: Displays the total count of issued qualifications in the system.
  - **Verification Operations**: Counts total verification evaluations executed.
  - **Active Issuers**: Shows the number of accredited authorities.
  - **Audit Chain Height**: Shows the exact block height (sequence number) of the append-only cryptographic ledger.
- **Buttons & Actions**:
  - **"Upload Document" Quick Action**: Navigates directly to `UploadDocument.jsx`.
  - **"Verify Document" Quick Action**: Navigates directly to `VerifyDocument.jsx`.
  - **"Issue Credential" Quick Action**: Navigates directly to `IssueCredential.jsx`.
  - **"Validate Hash Chain" Quick Action**: Navigates directly to `AuditChainValidation.jsx`.
  - **Recent Activity Table Rows**: Clicking on any credential or verification opens its detailed evidence view.

---

## 3. User / Credential Holder Section

### 3.1 Upload Document (`UploadDocument.jsx`)
- **Dropzone Area ("Click to browse or drag and drop")**:
  - Clicking opens the native OS file picker.
  - Accepts `.pdf`, `.png`, `.jpg`, `.jpeg` (up to 10 MB).
- **"Upload & Compute Hash" Button**:
  - **Backend Call**: Sends a `POST /api/documents/upload` multipart request with the binary payload.
  - **Backend Action**: Inspects file magic bytes (`%PDF`, PNG, or JPEG headers), blocks executables, computes the authoritative SHA-256 digest, and saves the file to local content-addressable storage.
  - **UI Result**: Displays the **Cryptographic Artifact Metadata** panel on the right with the generated `Document ID` and `SHA-256 Digest`.
- **Copy Hash Button (Clipboard Icon)**:
  - Copies the 64-character SHA-256 hexadecimal hash directly to your clipboard for use in verification queries.

### 3.2 Verify Document (`VerifyDocument.jsx`)
- **Input Fields**:
  - `Credential ID`: The unique identifier (`crd_...`).
  - `Document SHA-256 Hash`: The hexadecimal digest of the file being evaluated.
  - `Document Artifact ID (Optional)`: The `doc_...` ID.
- **"Evaluate Cryptographic Verification" Button**:
  - **Backend Call**: `POST /api/verifications/evaluate`.
  - **Backend Action**: Executes the **16-Gate Verification Pipeline**: checks issuer accreditation, key validity, Ed25519 signature mathematical match, document hash matching, revocation registries, and temporal expiration.
  - **UI Result**: Renders the **Trust Evidence Card**:
    - Displays overall outcome (e.g. `LEVEL 5 CURRENTLY_VALID: VERIFIED`).
    - Lists pass/fail indicators for all 16 discrete checks.
    - Displays issuer accreditation details and signing timestamps.
- **Manual Review Section (Auditors / Admins / HR)**:
  - Visible when reviewing flagged or low-confidence verifications.
  - **Review Decision Dropdown**: Choose between `CONFIRMED` or `REJECTED`.
  - **Notes Textarea**: Enter supervisor inspection findings.
  - **"Submit Manual Review Decision" Button**: Commits the review decision and appends a new hash-chained audit record.

### 3.3 Verification History (`VerificationHistory.jsx`)
- **Search & Filter Bar**: Filter historical verifications by Candidate ID, Result status (`VERIFIED`, `ALTERED`, etc.), or Trust Level.
- **"Refresh" Button**: Re-fetches the latest verification log entries from the server.
- **"View Evidence" Link**: Navigates to the discrete Evidence Package (`VerificationEvidence.jsx`) for that specific verification ID.

### 3.4 My Credentials (`MyCredentials.jsx`)
- **Credential Cards**: Lists all qualifications earned by or assigned to the logged-in user.
- **"Copy ID" Button**: Copies the credential identifier.
- **"View Document" Button**: Downloads or previews the original signed PDF/image.
- **"Verify This Credential" Button**: Automatically loads the credential ID into the Verification Engine and evaluates it.

### 3.5 Document Analysis - OCR & AI (`DocumentAnalysis.jsx`)
- **Document ID Input**: Enter any uploaded `doc_...` ID.
- **"Run Local OCR" Button**:
  - **Backend Call**: `POST /api/analysis/ocr`.
  - **Backend Action**: Invokes the local Tesseract.js engine against the document file on the server.
  - **UI Result**: Displays extracted text, structured field heuristics (Name, Degree, University, Conformance Date), and bounding-box confidence scores.
- **"Run AI Security Analysis" Button**:
  - **Backend Call**: `POST /api/analysis/document`.
  - **Backend Action**: Evaluates document heuristics for font inconsistencies, JPEG artifact anomalies around text blocks, and metadata tampering.
  - **UI Result**: Displays the AI Anomaly Score (Low / Moderate / High Risk) and advisory warning notes.

---

## 4. Issuer Management Section

### 4.1 Issuer Status (`IssuerStatus.jsx`)
- **Organization Binding Info**: Shows which accredited organization the user represents.
- **Status Badge**: Displays whether the issuer is `PENDING`, `ACTIVE`, `SUSPENDED`, or `REVOKED`.
- **"Register As Issuer" Form (for standard users)**:
  - **Inputs**: Organization selection, official job title, appointment gazette / resolution notes, contact phone.
  - **"Submit Issuer Request" Button**: Sends `POST /api/issuers/register`, submitting the request for administrative review.

### 4.2 Issue Credential (`IssueCredential.jsx`)
- **Form Inputs**:
  - `Issuer Profile`: Selects the authorized issuer account.
  - `Recipient User ID`: The target worker/student ID (`usr_...`).
  - `Document Artifact ID`: The uploaded document ID (`doc_...`).
  - `Credential Type`: `DEGREE`, `LICENSE`, `CERTIFICATION`, or `EMPLOYMENT`.
  - `Credential Title`: e.g. *"Master of Science in Cybersecurity"*.
  - `Validity Period (Days)`: Enter days until expiration (or 0 for perpetual validity).
- **"Issue Signed Credential" Button**:
  - **Backend Call**: `POST /api/credentials/issue`.
  - **Backend Action**: Builds the 9-field RFC 8785 canonical JSON payload, retrieves the issuer's private key from the secure filesystem, creates the Ed25519 digital signature, and writes an audit event to the hash chain.
  - **UI Result**: Displays a green success banner with the generated `Credential ID` and digital signature snippet.

### 4.3 Credential List (`CredentialList.jsx`)
- **Filter Tabs**: Filter by `ALL`, `ACTIVE`, `REVOKED`, or `EXPIRED`.
- **"Revoke" Button**:
  - Opens a modal prompting for a structured revocation reason (`DISCIPLINARY_ACTION`, `ISSUED_IN_ERROR`, etc.) and notes.
  - **Backend Action**: Invalidate the credential and hashes the revocation into the audit ledger.
- **"Create New Revision (v2+)" Button**:
  - Opens a revision form allowing title or document updates while automatically superseding the previous version.
- **"Timeline" Button**: Opens the modal showing the credential's complete revision and verification history.

### 4.4 Cryptographic Key Status (`KeyStatus.jsx`)
- **Key Cards**: Displays all public keys registered to the issuer.
- **Algorithm Badge**: Displays `ED25519`.
- **Public Key PEM Box**: Shows the SPKI public key format (with a **"Copy Public Key"** button).
- **Security Check**: Verifies that the private key is locked to disk and absent from the API/DB.
- **"Rotate Key" Button**: Retires the current key and generates a new active Ed25519 keypair.
- **"Mark Compromised" Button**: Flags the key as compromised with a timestamp, causing the verification engine to reject any credentials issued after that point.

---

## 5. HR / Verifier Section

### 5.1 HR Verify Document (`VerifyDocument.jsx`)
- Pre-configured specifically for recruiter and HR workflows to evaluate candidate claims.

### 5.2 Verify Official Source (`VerifyOfficialSource.jsx`)
- **Purpose**: Query authoritative external databases (e.g. Higher Education Degree Verification Registry).
- **Registry Selection**: Choose from accredited sources.
- **Target Query Identifier**: Enter the student registration number or national license ID.
- **"Query Official Source" Button**:
  - **Backend Call**: `POST /api/verifications/verify-source`.
  - **Backend Action**: Executes the official source adapter.
  - **UI Result**: Distinguishes whether the external source provided **`SOURCE_VERIFIED`** (cryptographic confirmation) or **`SOURCE_FOUND`** (database record without cryptographic proof).

---

## 6. Auditor & Compliance Section

### 6.1 Hash-Chained Audit Logs (`AuditLogs.jsx`)
- **Chained Event Table**:
  - Displays chronological records: Sequence Number, Timestamp, Actor ID, Actor Role, Action (`CREDENTIAL_ISSUED`, `VERIFICATION_EVALUATED`, etc.), and Current SHA-256 Hash.
- **"Inspect Entry" Button**:
  - Expands the row to reveal the JCS canonical metadata payload and the `previousHash` linking to the predecessor record.
- **"Export Audit Trail" Button**:
  - Downloads the complete audit trail as a signed JSON package for external regulatory submission.

### 6.2 Verification Evidence (`VerificationEvidence.jsx`)
- **Verification ID Lookup**: Enter any `vrf_...` ID.
- **"Fetch Complete Evidence Package" Button**:
  - Retrieves the standalone evidence envelope containing the exact public key certificate active at signing time, canonical claims, digital signature, and proof path.

### 6.3 Audit Chain Validation (`AuditChainValidation.jsx`)
- **"Validate Entire Hash Chain" Button**:
  - **Backend Call**: `GET /api/audit-logs/validate`.
  - **Backend Action**: Recalculates every SHA-256 hash from Genesis (`GENESIS_SECUREWORK_VERIFY`) to the head of the chain.
  - **UI Result**:
    - If pristine: Displays a green **"CRYPTOGRAPHICALLY VALID"** shield banner with verified record count.
    - If tampered: Displays a red **"TAMPERING DETECTED"** banner pinpointing the exact sequence number where the computed hash diverged from the stored hash.

---

## 7. Administration Section

### 7.1 User Directory & RBAC (`AdminUsers.jsx`)
- **User Directory Table**: Lists all registered users with their roles (`ADMIN`, `ISSUER`, `HR`, `AUDITOR`, `USER`).
- **"Edit Role" Dropdown**:
  - Change user roles (e.g. promote a compliance reviewer to `AUDITOR`).
- **"Save Role" Button**: Updates user permissions via `PATCH /api/users/:id/role`.

### 7.2 Organizations & Trust (`AdminOrganizations.jsx`)
- **"Register New Organization" Button**:
  - Opens modal: Name, Organization Code, Official Domain, Type (`UNIVERSITY`, `ENTERPRISE`, etc.).
- **"Approve & Verify" Button**:
  - Transitions organization to `VERIFIED` status, unlocking issuer onboarding.
- **"Suspend" / "Revoke" Buttons**:
  - Suspends or permanently revokes institutional authority.

### 7.3 Trusted Sources (`AdminTrustedSources.jsx`)
- **Source Registry Cards**: Lists official external verification endpoints.
- **"Add Trusted Source" Button**: Registers a new verified external registry with SSRF validation rules.
- **"Toggle Source State" Button**: Enables or disables active querying of a source.

### 7.4 Issuer Accreditation (`AdminIssuers.jsx`)
- **Pending Requests Table**: Displays all user applications seeking `ISSUER` privileges.
- **"Approve Accreditation" Button**:
  - Transitions the issuer profile to `ACTIVE`.
  - Automatically generates an Ed25519 signing keypair.
  - Promotes the applicant user to the `ISSUER` role.
- **"Reject" Button**: Rejects application with feedback notes.

### 7.5 System Health & Settings (`AdminSystemSettings.jsx`)
- **Service Telemetry**:
  - Node.js runtime version, platform architecture, uptime timer, memory consumption.
- **Database Status**:
  - Shows live MongoDB connection status (`connected: true`), host (`127.0.0.1`), and active database name (`securework_verify`).
- **Engine Flags**:
  - Displays toggle states for `OCR_ENABLED`, `AI_ENABLED`, and engine drivers (`Tesseract.js Local`, `Local AI Heuristics`).
