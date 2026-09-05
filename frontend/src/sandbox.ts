/** Explicit public sandbox: synthetic fixtures + browser-local review state. No API/AI. */
import type { SupplierCase } from "./types";
export const sandboxMode = import.meta.env?.VITE_DEMO_MODE === "true";
const storageKey = "supplier-studio-sandbox-v1";
const labels: Record<string, string> = {
  supplier_name: "Supplier name",
  registration_number: "Registration number",
  bank_account: "Bank account",
};
const fixtureText: Record<string, string> = {
  registration:
    "SYNTHETIC DEMO — not a real company document\nRegistration certificate\nSupplier name: Cedar Works\nRegistration number: DEMO-2024-001",
  bank: "SYNTHETIC DEMO — not a real bank account\nBank confirmation\nSupplier name: Cedar Works\nBank account: DEMO-ACCOUNT-0192",
  form: "SYNTHETIC DEMO — intentionally conflicting application\nSupplier onboarding form\nSupplier name: Cedar Works\nRegistration number: DEMO-2024-009\nBank account: DEMO-ACCOUNT-0192",
};
function assess(c: SupplierCase) {
  for (const [key, label] of Object.entries(labels)) {
    const evidence = c.documents.flatMap((d) => {
      const quote = d.pages[0]
        .split("\n")
        .find((line) => line.startsWith(label + ":"));
      return quote
        ? [
            {
              value: quote.slice(label.length + 1).trim(),
              quote,
              page: 1,
              document: d.name,
              document_id: d.id,
            },
          ]
        : [];
    });
    const values = new Set(evidence.map((e) => e.value.toLowerCase()));
    c.fields[key] = {
      label,
      state:
        values.size === 0
          ? "missing"
          : values.size > 1
            ? "conflict"
            : "matched",
      value: evidence[0]?.value || "",
      evidence,
    };
  }
  readiness(c);
}
function readiness(c: SupplierCase) {
  c.missing_documents = Object.keys(fixtureText).filter(
    (k) => !c.documents.some((d) => d.kind === k),
  );
  c.ready =
    c.missing_documents.length === 0 &&
    Object.values(c.fields).every((f) =>
      ["matched", "resolved"].includes(f.state),
    );
}
function newCase(id: number, name: string): SupplierCase {
  const c: SupplierCase = {
    id,
    name,
    status: "pending",
    ready: false,
    missing_documents: [],
    fields: {},
    documents: [],
    events: [
      {
        actor: "Sandbox reviewer",
        action: "created",
        details: { note: "Synthetic browser-local application." },
        at: new Date().toISOString(),
      },
    ],
  };
  assess(c);
  return c;
}
function addFixture(c: SupplierCase, kind: string) {
  c.documents.push({
    id: Date.now() + c.documents.length,
    name: kind + ".txt",
    kind,
    mode: "fixture",
    pages: [fixtureText[kind]],
  });
  assess(c);
}
function initial() {
  const c = newCase(1, "Cedar Works · supplier application");
  Object.keys(fixtureText).forEach((k) => addFixture(c, k));
  return [c];
}
function read(): SupplierCase[] {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* Storage is optional in private browsing. */
  }
  return initial();
}
let cases = read();
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(cases));
  } catch {
    /* In-memory demo remains usable if storage is unavailable. */
  }
}
export function resetSandbox() {
  cases = initial();
  save();
}
export async function sandboxApi(path: string, options: RequestInit = {}) {
  if (path === "/session")
    return { user: "Sandbox reviewer", mode: "sandbox", demo: true };
  const data = typeof options.body === "string" ? JSON.parse(options.body) : {};
  if (path === "/cases" && options.method === "POST") {
    const c = newCase(
      Math.max(0, ...cases.map((c) => c.id)) + 1,
      data.name.trim(),
    );
    cases.unshift(c);
    save();
    return structuredClone(c);
  }
  if (path === "/cases") return { cases: structuredClone(cases) };
  const match = path.match(/^\/cases\/(\d+)\/(review|documents)$/);
  const c = cases.find((item) => item.id === Number(match?.[1]));
  if (!match || !c) throw new Error("Sandbox action unavailable.");
  if (c.status !== "pending")
    throw new Error(
      "Decided applications are read-only. Reset the demo to start again.",
    );
  if (match[2] === "documents") {
    const kind = (options.body as FormData).get("kind") as string;
    if (!Object.hasOwn(fixtureText, kind))
      throw new Error("Choose a synthetic fixture.");
    addFixture(c, kind);
    c.events.unshift({
      actor: "Sandbox reviewer",
      action: "fixture added",
      details: { note: `${kind} fixture added. Prior corrections cleared.` },
      at: new Date().toISOString(),
    });
  } else {
    if (typeof data.reason !== "string" || data.reason.trim().length < 5)
      throw new Error("Explain the review in at least five characters.");
    const draft = structuredClone(c);
    for (const [key, value] of Object.entries(data.corrections || {})) {
      if (draft.fields[key] && typeof value === "string" && value.trim()) {
        draft.fields[key].value = value.trim();
        draft.fields[key].state = "resolved";
      }
    }
    readiness(draft);
    if (data.decision === "approved" && !draft.ready)
      throw new Error(
        "Resolve every field and add all three document types before approval.",
      );
    if (data.decision !== "save") draft.status = data.decision;
    draft.events.unshift({
      actor: "Sandbox reviewer",
      action: data.decision === "save" ? "corrections saved" : data.decision,
      details: { reason: data.reason },
      at: new Date().toISOString(),
    });
    Object.assign(c, draft);
  }
  save();
  return structuredClone(c);
}
