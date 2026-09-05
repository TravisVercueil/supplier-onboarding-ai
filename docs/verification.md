# Verification record

Local verification performed on 5 September 2026 using Python 3.12, Node 24 and PostgreSQL 17 (Docker Compose).

- Django: **18 tests passed** on both the explicit SQLite demo database and PostgreSQL.
- Frontend: **3 sandbox tests passed**; TypeScript check and Vite production builds passed for local API and `VITE_DEMO_MODE=true` modes. Prettier check passed.
- Migration drift: `python manage.py makemigrations --check --dry-run` reported no changes.
- Offline evaluation: **21/24 field slots**, **7/8 exact documents**, **2/2 conflict scenarios**. Unstructured prose intentionally remains unsupported by the baseline. No live model calls were made; the real-provider adapter is covered by a stubbed HTTP test.
- Real PostgreSQL HTTP smoke: session/CSRF login, create application, three multipart uploads, conflicting registration evidence, corrected approval and persisted audit all passed. Restarting Django preserved the approval, three documents and audit history, verified with a fresh authenticated HTTP session.

The HTTP smoke used only repository synthetic text fixtures. Tests also create and parse an actual text-based PDF, reject scanned/invalid PDFs, and enforce review/authentication boundaries. This record does not imply production readiness, load testing, live-provider evaluation or tamper-proof auditing.
