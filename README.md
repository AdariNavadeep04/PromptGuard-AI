# Context-Aware Sensitive Prompt Guard for GenAI 🛡️

A production-grade, privacy-first full-stack application that acts as an intelligent security layer between users and Generative AI (LLM) models.

Unlike naive PII detectors that blindly mask everything or return static error messages, **Prompt Guard** performs **contextual analysis**, **risk classification**, **policy enforcement**, and **interactive user control** to ensure that minimum necessary data is shared with external AI services without breaking user productivity.

---

## 🌟 Key Features & Pipeline Steps

1. **Multi-Engine Detection**:
   - **Regex Engine**: Highly optimized detectors for Email, Indian Phone Numbers (+91 variants), PAN Card (`AAAAA9999A`), Aadhaar (`1234 5678 9012`), UPI ID (`name@bank`), Bank Accounts, IFSC (`AAAA0NNNNNN`), API Keys, Passwords.
   - **In-Browser NER Engine**: Transformers.js ONNX (`Xenova/bert-base-NER`) running locally in WebAssembly for Person Names, Locations, Organizations + heuristic fallback.

2. **Conflict & Overlap Resolution**:
   - Priority rules resolve conflicts between Regex and NER engines.
   - Span-based overlap algorithm merges nested or duplicate ranges to prevent token corruption.

3. **Confidence Scoring**:
   - Assigns normalized 0–1 confidence scores with 3 operational tiers: High (≥0.90), Medium/Possible (0.70–0.89), Low (<0.70).
   - High confidence detects automatically; Medium flags for user confirmation.

4. **Risk Classification & Privacy Policy Engine**:
   - 4-Tier Risk Model: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.
   - 3 Privacy Enforcement Modes:
     - **Basic**: Protects critical secrets (API Keys, Passwords, Credit Cards/PAN).
     - **Balanced** (Default): Protects critical secrets + high-risk identifiers (Phones, Aadhaar, Accounts).
     - **Strict**: Max privacy — masks all identified sensitive entities regardless of context.

5. **Data Minimization & Placeholder Engine**:
   - Generates bidirectional `[TYPE_N]` placeholders (`[NAME_1]`, `[PHONE_1]`).
   - Maintains transient in-memory mapping.

6. **Context-Aware Necessity Analysis**:
   - Classifies task type (e.g., Leave Email, Tax Calculation, Medical Consultation, Code Review).
   - Evaluates whether each entity is **strictly necessary** to complete the prompt's objective.
   - Provides clear human-readable explanations and actionable recommendations (`KEEP`, `MASK`, `REMOVE`).

7. **Interactive User Control & Granular Overrides**:
   - User override controls for every single entity (`Keep Original`, `Mask Value`, `Remove Entirely`).
   - Interactive confirmation for flagged medium-confidence entities.
   - False positive "NO" button to unmark incorrectly flagged words.

8. **Sanitization & Verification**:
   - Performs prompt transformation based on final decisions.
   - Secondary verification pass ensures no removed values linger in the prompt string.

9. **Prompt Injection & Privacy Bypass Defense**:
   - Application-level scanner checks for jailbreak attempts like *"ignore privacy rules"*, *"reveal original placeholders"*, or *"override sanitizer"*.
   - Blocks malicious requests before they reach the backend or LLM.

10. **Fail-Closed Security & Explicit Consent**:
    - If detection fails or injection is detected, prompt transmission is blocked.
    - Explicit visual consent dialog before external transmission.

11. **Output Privacy Checker**:
    - Scans incoming LLM response against session sensitive values to detect accidental data leaks.

12. **Multi-Image Support & In-Browser OCR (Up to 5 Images)**:
    - Attach up to 5 images simultaneously (PNG, JPEG, WebP) with client-side compression and live image cards.
    - Automatic Tesseract.js OCR scans all images in parallel/sequence and feeds any detected sensitive text into the privacy pipeline.
    - If images contain no text (visual only) or image+text, seamlessly sends all attached images to Gemini Multimodal Vision after privacy checks.

13. **Live Evaluation Engine**:
    - Runs test benchmarks directly in the browser and calculates exact metrics (**Precision, Recall, F1 Score**) without invented figures.

14. **Zero-Log & Ephemeral Memory**:
    - **"Clear Sensitive Data"** button destroys session key-value maps immediately.
    - Raw sensitive values are NEVER written to disk, server logs, or local storage.

---

## 🏗️ System Architecture

```
[ User Input (Text / Image) ]
              │
              ▼
   [ In-Browser OCR (Tesseract.js) ] (If Image Uploaded)
              │
              ▼
 ┌─────────────────────────────────────────────────────────┐
 │               Local In-Browser Pipeline                 │
 ├─────────────────────────────────────────────────────────┤
 │ 1. Regex Detectors + NER (Transformers.js ONNX)         │
 │ 2. Conflict Resolver + Overlap Resolver                 │
 │ 3. Confidence Scorer (High / Medium / Low)              │
 │ 4. Risk Classifier & Policy Engine                      │
 │ 5. Placeholder Engine ([NAME_1], [PHONE_1])             │
 │ 6. Context Analyzer (Task Necessity Reasoning)          │
 └────────────────────────────┬────────────────────────────┘
                              │
                              ▼
        [ Interactive User Control Panel & False Positive UI ]
                              │
                              ▼
    [ Sanitizer + Verification Pass + Prompt Injection Check ]
                              │
                              ▼
              [ External Consent Dialog Modal ]
                              │
                              ▼ (HTTPS POST with sanitized prompt)
 ┌─────────────────────────────────────────────────────────┐
 │                    Node.js Backend                      │
 ├─────────────────────────────────────────────────────────┤
 │ 1. Helmet Security Headers & Rate Limiting              │
 │ 2. Request Sanitization Validation                      │
 │ 3. Zero-Log Audit Logger                                │
 │ 4. LLM Service (Google Gemini API / Offline Fallback)   │
 └────────────────────────────┬────────────────────────────┘
                              │
                              ▼
                 [ Google Gemini LLM API ]
                              │
                              ▼
    [ Output Privacy Checker & Local Value Restoration ]
                              │
                              ▼
                     [ Final Clean Output ]
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

1. **Clone & Navigate**:
   ```bash
   cd prompt-guard
   ```

2. **Install Backend Dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the `backend/` directory (or copy `.env.example`):
   ```bash
   cp .env.example .env
   ```
   *Optional*: Add your Google Gemini API Key:
   ```env
   PORT=3001
   LLM_API_KEY=your_actual_gemini_api_key_here
   ```
   *(If no API key is provided, the application automatically runs in **Simulated Offline Mode** so you can test all features offline!)*

4. **Start Application**:
   ```bash
   npm start
   ```

5. **Access Web Application**:
   Open your browser and navigate to:
   ```
   http://localhost:3001
   ```

---

## 📁 Project Structure

```
prompt-guard/
├── frontend/
│   ├── index.html            # Main HTML UI with responsive controls & modals
│   ├── styles.css            # Custom CSS design system (Dark mode, glassmorphism)
│   ├── regexDetectors.js     # Regex detection patterns (Email, Phone, PAN, Aadhaar, UPI, etc.)
│   ├── nerDetector.js        # Local Transformers.js ONNX NER & heuristic fallback
│   ├── detector.js           # Detection engine orchestrator
│   ├── conflictResolver.js   # Priorities and conflict resolution
│   ├── overlapResolver.js    # Text span overlap merging
│   ├── confidence.js         # Confidence score normalization & thresholding
│   ├── riskClassifier.js     # 4-tier risk classification
│   ├── privacyPolicy.js      # Privacy Policy Engine & Mode enforcer
│   ├── placeholderEngine.js  # Ephemeral [TYPE_N] placeholder creation & map
│   ├── sessionManager.js     # Ephemeral session creation & cleanup
│   ├── contextAnalyzer.js    # Task classification & entity necessity reasoning
│   ├── sanitizer.js          # Prompt sanitizer & secondary verification pass
│   ├── promptInjection.js    # Application-level prompt injection scanner
│   ├── outputChecker.js      # Response leak detector & restorer
│   ├── ocr.js                # Tesseract.js browser OCR runner
│   ├── evaluation.js         # Precision / Recall / F1 test harness
│   └── app.js                # Main application orchestrator & UI handler
├── backend/
│   ├── package.json          # Node.js dependencies
│   ├── server.js             # Express server setup with Helmet & CORS
│   ├── .env.example          # Sample environment config
│   ├── middleware/
│   │   └── security.js       # Payload validation & Zero-Log audit logger
│   ├── routes/
│   │   └── llm.js            # Express API endpoints (/api/generate)
│   └── services/
│       └── llmService.js     # Gemini API integration & simulation provider
├── tests/
│   ├── detection-tests.json  # 10+ detailed entity detection test cases
│   ├── context-tests.json    # Task context necessity test benchmark
│   └── evaluation-tests.json # Combined evaluation benchmark dataset
└── README.md                 # Complete documentation
```

---

## 🔒 Security & Threat Model

### Data Privacy Commitments
- **Zero Raw PII Transmission**: Raw sensitive values chosen for masking or removal NEVER leave the client browser.
- **Zero Log Persistence**: The backend logs only request metadata (timestamps, status codes, truncated session hashes). Raw prompt bodies are NEVER logged.
- **Zero Disk Storage**: Placeholder mappings are stored purely in memory JS objects and destroyed upon clicking "Clear Sensitive Data" or closing the tab.
- **Application-Level Security Boundary**: Policy enforcement is performed in code logic before calling external LLM APIs — not left to system prompt instructions that could be bypassed by adversarial prompts.

---

## 📊 Evaluation & Metrics

The application includes an **Evaluation Dashboard** built right into the UI.
It evaluates the detection engine against the test benchmark datasets (`tests/detection-tests.json`) and calculates real, un-invented performance metrics:

$$\text{Precision} = \frac{TP}{TP + FP}$$

$$\text{Recall} = \frac{TP}{TP + FN}$$

$$F_1 = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$

---

## ⚠️ Disclaimer & Limitations

1. **Heuristic & ML Boundaries**: PII and sensitive data detection is inherently probabilistic. While this guard combines rule-based regexes and local ML (NER), no detection engine can guarantee 100% recall across all domain-specific formats or obfuscated text.
2. **Local Client Resources**: Browser NER relies on Transformers.js loading an ONNX model. On low-memory or restricted networks, the system gracefully falls back to regex + pattern heuristic detectors.
3. **Defense in Depth**: This guard is designed as a client-side and application-layer security filter to minimize data exposure. It should be used as part of a defense-in-depth security strategy alongside standard encryption, access controls, and organization data governance policies.

---

## 📜 License

MIT License — free for educational, research, and hackathon use.
