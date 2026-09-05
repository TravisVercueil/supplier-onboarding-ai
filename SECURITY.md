# Security

This is a localhost, single-workspace portfolio demonstration, not a hosted supplier-data service. Demo credentials are public by design. Do not expose the development servers to the internet or upload real personal/banking records. Session authentication and CSRF protect the API; all signed-in users share the same workspace. Audit entries are application records, not a tamper-proof regulatory ledger.

Report a vulnerability privately to travisvercueil@gmail.com. Do not include secrets or real supplier records. Before public backend hosting, add deployment hardening, rate limits, a real account lifecycle, HTTPS, file-scanning/resource isolation, retention controls and a security review. OpenAI mode sends extracted document text to OpenAI; baseline mode makes no model requests.
