# Supplier Studio

**Evidence-first supplier onboarding, built with Django, React and TypeScript.**

A reviewer receives a supplier pack, compares extracted information with its source documents, resolves contradictions and records a decision. The application keeps the original evidence alongside corrections and an audit history. Built by [Travis Vercueil](https://github.com/TravisVercueil).

> **[Open the live sandbox →](https://supplier-onboarding-ai.vercel.app)** — synthetic documents, browser-local review state and **no live AI calls**. The complete Django application runs locally with real text/PDF uploads, database persistence and an optional model adapter. This is a portfolio MVP, not a production compliance service.

The interface uses official Fluent UI React components: an application queue, document evidence and reviewer controls arranged side by side. See [DESIGN.md](DESIGN.md) for the reference analysis, component choices and responsive layout.

## What you can do

- Create an application and upload registration, bank-confirmation and onboarding documents.
- Extract labelled fields from UTF-8 text or text-based PDFs, with document/page/quote evidence.
- Identify missing documents, absent fields and conflicting values across documents.
- Correct fields with a reason, then approve or reject the application. Approval is blocked until requirements are satisfied.
- Inspect a persistent audit history. Decided cases are read-only; new evidence clears earlier corrections for re-review.
- Compare a deterministic baseline against a small reproducible evaluation set, or configure real model extraction explicitly.

## Try the public sandbox locally

Requires **Node 24** (Node 22.12+ also supports the build).

```sh
npm ci --prefix frontend
VITE_DEMO_MODE=true npm run dev --prefix frontend -- --host 127.0.0.1 --port 5202
```

Open [localhost:5202](http://127.0.0.1:5202). No account, backend, model key or external service is needed. State is saved in this browser; **Reset demo** restores the fixture. Actual file uploads are unavailable in the public sandbox: **Add synthetic fixture** adds a bundled sample explicitly.

### Two-minute walkthrough

1. Open **Cedar Works · supplier application**. The registration number is marked **Conflict**.
2. Click the certificate evidence: it says `DEMO-2024-001`; the onboarding form says `DEMO-2024-009`.
3. Enter `DEMO-2024-001` in **Correct Registration number**. Add the reason: “Verified the registration certificate; the onboarding form contains a typo.”
4. Choose **Approve supplier**. The application becomes read-only, and the decision appears in the history.
5. Create another application and try approval without documents. The backend/sandbox blocks it. Reset the sandbox to explore again.

## Run the full application

Requires **Python 3.12** and **Node 24**. SQLite is the explicit zero-configuration **local demo** database; PostgreSQL is supported below. Run commands from the repository root.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8102
```

In another terminal:

```sh
npm ci --prefix frontend
npm run dev --prefix frontend -- --host 127.0.0.1 --port 5102
```

Open [localhost:5102](http://127.0.0.1:5102). Sign in with `reviewer` / `local-review-only`. These are intentionally public **local demo credentials**. `DEMO_PASSWORD` overrides the password when the user is first created. Demo seeding is idempotent and does not overwrite existing decisions or credentials.

The frontend proxies `/api` to Django on port 8102; it never receives model credentials. Use the files in [`fixtures/`](fixtures/) for uploads. Uploads are processed synchronously, limited to 5 MB, 20 PDF pages and 60,000 characters. Scanned/OCR-only PDFs and encrypted PDFs are unsupported. PDF/text content is stored as extracted text, not the original binary.

### PostgreSQL

Docker Compose starts **only PostgreSQL**, bound to localhost. Development servers still run as above.

```sh
docker compose up -d --wait
export POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5434
export POSTGRES_DB=supplier POSTGRES_USER=supplier POSTGRES_PASSWORD=local-demo-change-me
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8102
```

Export the same variables when running tests against PostgreSQL. The local demo database user can create Django's isolated test database. `docker compose down` stops the database and preserves the volume. Do not use the demo password for hosted services.

### Optional real AI extraction

Default `EXTRACTION_MODE=baseline` is **deterministic labelled-field parsing**, not an LLM. It runs entirely offline. For a real model request, set server environment variables:

```sh
export EXTRACTION_MODE=openai
export OPENAI_API_KEY='<your key>'
export OPENAI_MODEL='<compatible chat-completions model ID>'
python manage.py runserver 127.0.0.1:8102
```

Choose a model supporting Chat Completions, JSON object output, temperature and `max_completion_tokens`. The adapter uses Python's standard HTTP client with a 30-second timeout, a 1 MB response ceiling and a 1,500-token output cap. Failed or invalid responses save no document. **Document text is sent to OpenAI in this mode; use synthetic data only.** There is no automatic fallback to baseline. Real-provider accuracy, latency and cost have not been measured; provider tests use an explicitly stubbed HTTP response.

Evidence validation ensures a returned value appears verbatim in a quote on its cited page. It does **not** prove that the model assigned the right semantic field, that a document is authentic, or that a claim is true. Human review is required. Conflicting repeated fields within a single document are rejected by the baseline rather than silently overwritten.

Environment examples are in [`.env.example`](.env.example) and [`frontend/.env.example`](frontend/.env.example). Django does not implicitly load `.env`; export the variables you need. No API key belongs in a `VITE_` variable.

## Verification

```sh
python manage.py test
python manage.py evaluate
python manage.py makemigrations --check --dry-run
npm test --prefix frontend
npm run build --prefix frontend
VITE_DEMO_MODE=true npm run build --prefix frontend
```

The backend suite covers session access, CSRF, invalid uploads, actual text-PDF parsing, evidence validation, repeated-field conflicts, review requirements, rollback, audit persistence and decision immutability. The frontend sandbox suite exercises conflict resolution, blocked approval and new-evidence invalidation.

**Offline baseline evaluation:** 8 synthetic development documents, 24 field slots (including correctly absent values). Current result: **21/24 (87.5%)**, **7/8 exact documents**, and **2/2 conflict scenarios**. One unstructured-prose example deliberately fails to expose the baseline's limit. Zero model calls and $0 model cost. Runtime is printed on each run, not presented as a production performance claim. This is a small development fixture set, **not held-out validation or production accuracy**.

## Architecture and decisions

```text
React / TypeScript ── session + CSRF ── Django API ── SQLite demo / PostgreSQL
                                          │
                                PDF/text → extraction
                                baseline OR explicit OpenAI
                                          │
                               cited fields → human review
                                          │
                                   persisted audit events

Public Vercel sandbox → bundled synthetic fixtures → browser storage only
```

| Choice | Reason and boundary |
| --- | --- |
| Django sessions, CSRF and ORM | Use established framework behavior instead of custom authentication or persistence. |
| One shared reviewer workspace | Demonstrates the review lifecycle without inventing untested tenant isolation. All signed-in users share access. |
| Synchronous bounded extraction | Small local document packs do not need a worker queue. Add workers for measured throughput/resource needs. |
| PostgreSQL + explicit SQLite demo | Real relational persistence with a friction-free local entry point. Production concurrency has not been load-tested. |
| Source evidence retained | Corrections stay separate from uploaded evidence; decisions have human reasons. Audit data is not tamper-proof. |
| Separate sandbox transport | Recruiters can inspect the workflow without credentials or model spend; it is explicitly not the backend. |

Useful entry points: [`onboarding/extraction.py`](onboarding/extraction.py), [`onboarding/views.py`](onboarding/views.py), [`frontend/src/main.tsx`](frontend/src/main.tsx), [`frontend/src/sandbox.ts`](frontend/src/sandbox.ts).

## Deploy the public sandbox to Vercel

Import this repository, choose **Root Directory `frontend`**, and set **`VITE_DEMO_MODE=true`**. Build with `npm run build`; output is `dist`. `frontend/vercel.json` records these settings. No backend or model key is needed. Do not deploy the local Django development server as a public service.

## Scope and responsible use

No OCR, document authenticity verification, tenant separation, email, external procurement integrations or automated compliance decision is claimed. Production hosting would need account lifecycle controls, rate limits, file-processing isolation, HTTPS/deployment hardening, retention rules and security review. See [SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

All fixtures are original synthetic examples. No employer code, customer records, real bank details or internal operational data are included. [MIT licensed](LICENSE).
