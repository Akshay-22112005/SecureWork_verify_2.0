# AI & Machine Learning Heuristics Specification

## 1. Role of AI in SecureWork Verify

In SecureWork Verify, Machine Learning and heuristic algorithms serve exclusively as **Document Fraud & Tampering Anomaly Detectors**. AI never issues automated rejections; instead, it provides structured advisory risk reports to human compliance officers.

---

## 2. Fraud & Tampering Heuristics Suite

```mermaid
flowchart TD
    Doc[Uploaded Document / Certificate] --> ELA[Error Level Analysis\n(Compression Artifacts)]
    Doc --> FontAnalysis[Font & Kerning Inconsistency Detection]
    Doc --> MetaCheck[Metadata & EXIF Forensics\n(Editing Software Traces)]
    Doc --> LayoutAudit[Template Geometry & Alignment Audit]

    ELA --> Aggregator[Heuristic Risk Aggregator]
    FontAnalysis --> Aggregator
    MetaCheck --> Aggregator
    LayoutAudit --> Aggregator

    Aggregator --> Report[Advisory Tamper Risk Report]
```

### 1. Error Level Analysis (ELA)
* Identifies areas of an image with differing compression levels, revealing digitally spliced text or cloned seals.

### 2. Font & Kerning Forensics
* Analyzes letter spacing, baseline alignment, and rasterization anti-aliasing across credential text. Spliced names or dates frequently exhibit distinct rendering baselines.

### 3. EXIF & PDF Metadata Forensics
* Inspects container headers for signatures of image editing tools (e.g. Adobe Photoshop, GIMP, Canva) or mismatched creation vs. modification timestamps.

### 4. Template Geometry
* Compares the positioning of official logos, signatures, and seals against baseline templates for accredited institutions.

---

## 3. Advisory Risk Report Format

```json
{
  "documentId": "doc_8821a",
  "overallRiskLevel": "LOW",
  "anomalyScore": 0.12,
  "checks": [
    { "type": "EXIF_FORENSICS", "passed": true, "details": "No editing software signatures detected" },
    { "type": "ERROR_LEVEL_ANALYSIS", "passed": true, "details": "Uniform compression across all text blocks" },
    { "type": "FONT_ALIGNMENT", "passed": true, "details": "Consistent typography across candidate details" }
  ],
  "advisoryRecommendation": "PROCEED_TO_CRYPTOGRAPHIC_VERIFICATION"
}
```
