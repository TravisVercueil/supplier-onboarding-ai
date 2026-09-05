import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Badge,
  Button,
  Field,
  FluentProvider,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Textarea,
  Toolbar,
  ToolbarButton,
  createLightTheme,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowReset20Regular,
  Checkmark20Regular,
  Dismiss20Regular,
  DocumentText20Regular,
  Save20Regular,
  SignOut20Regular,
} from "@fluentui/react-icons";
import "./style.css";
import type { SupplierCase as Case } from "./types";
import { sandboxMode, sandboxApi, resetSandbox } from "./sandbox";
async function api(path: string, options: RequestInit = {}) {
  if (sandboxMode) return sandboxApi(path, options);
  const token =
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrftoken="))
      ?.split("=")[1] || "";
  const response = await fetch("/api" + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "X-CSRFToken": token,
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}
const theme = createLightTheme({
  10: "#001214",
  20: "#00262b",
  30: "#003b42",
  40: "#004751",
  50: "#005562",
  60: "#006471",
  70: "#006e7a",
  80: "#007b86",
  90: "#238995",
  100: "#4098a3",
  110: "#5da7b1",
  120: "#79b6bf",
  130: "#96c6cd",
  140: "#b3d6dc",
  150: "#d0e6e9",
  160: "#edf6f7",
});
type Citation = { document: number; page: number; quote: string };
function Status({ value }: { value: string }) {
  const color =
    value === "conflict" || value === "rejected"
      ? "danger"
      : value === "missing"
        ? "warning"
        : ["matched", "resolved", "approved"].includes(value)
          ? "success"
          : "informative";
  return (
    <Badge className="status-badge" appearance="tint" color={color}>
      {value === "pending" ? "Needs review" : value}
    </Badge>
  );
}
function SourceText({ text, quote }: { text: string; quote?: string }) {
  const start = quote ? text.indexOf(quote) : -1;
  return (
    <pre>
      {start < 0 ? (
        text
      ) : (
        <>
          {text.slice(0, start)}
          <mark>{quote}</mark>
          {text.slice(start + quote!.length)}
        </>
      )}
    </pre>
  );
}
function App() {
  const [user, setUser] = useState<string | null>(null),
    [loaded, setLoaded] = useState(false),
    [mode, setMode] = useState("baseline");
  const [cases, setCases] = useState<Case[]>([]),
    [selected, setSelected] = useState<number | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({}),
    [reason, setReason] = useState(""),
    [source, setSource] = useState<number | null>(null);
  const current = cases.find((c) => c.id === selected);
  const unresolvedCount = current
    ? Object.values(current.fields).filter((f) =>
        ["missing", "conflict"].includes(f.state),
      ).length
    : 0;
  const [citation, setCitation] = useState<Citation | null>(null);
  const selectedDocument = current?.documents.find((d) => d.id === source);
  useEffect(() => {
    setSource(current?.documents[0]?.id ?? null);
    setCitation(null);
  }, [current?.id]);
  useEffect(() => {
    if (citation)
      document
        .getElementById(`source-page-${citation.page}`)
        ?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [citation]);
  async function refresh() {
    const data = await api("/cases");
    setCases(data.cases);
    setSelected((s) => s ?? data.cases[0]?.id ?? null);
  }
  useEffect(() => {
    api("/session")
      .then(async (s) => {
        setUser(s.user);
        setMode(s.mode);
        if (s.user) await refresh();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  function update(c: Case) {
    setCases((items) => items.map((i) => (i.id === c.id ? c : i)));
  }
  async function review(decision: string) {
    if (!current) return;
    await act(async () => {
      update(
        await api(`/cases/${current.id}/review`, {
          method: "POST",
          body: JSON.stringify({ decision, corrections, reason }),
        }),
      );
      setCorrections({});
      setReason("");
      setNotice(
        decision === "save"
          ? "Corrections saved with an audit entry."
          : `Case ${decision}. Review is now read-only.`,
      );
    });
  }
  return (
    <FluentProvider theme={theme} className="app-shell">
      <a className="skip-link" href="#main">
        Skip to review workspace
      </a>
      <header className="app-bar">
        <a className="brand" href="#main">
          <span className="brand-mark">S</span>Supplier Studio
        </a>
        <span className="app-context">Supplier operations</span>
        {user && !sandboxMode && (
          <Toolbar aria-label="Account actions">
            <ToolbarButton
              icon={<SignOut20Regular />}
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await api("/logout", { method: "POST" });
                  setUser(null);
                  setCases([]);
                  setSelected(null);
                  setSource(null);
                  setCorrections({});
                })
              }
            >
              Sign out
            </ToolbarButton>
          </Toolbar>
        )}
      </header>
      <div className="environment-bar">
        <span>
          {sandboxMode
            ? "Interactive sandbox · synthetic documents · no live AI calls"
            : mode === "baseline"
              ? "Local demo · deterministic extraction · no model calls"
              : "Local workspace · OpenAI extraction"}
        </span>
        {sandboxMode && (
          <Button
            icon={<ArrowReset20Regular />}
            size="small"
            onClick={() =>
              act(async () => {
                resetSandbox();
                setSelected(1);
                setCorrections({});
                setReason("");
                setSource(null);
                setCitation(null);
                await refresh();
                setNotice("Sandbox reset to the original synthetic example.");
              })
            }
          >
            Reset demo
          </Button>
        )}
      </div>
      <main id="main">
        <div className="feedback" role="alert">
          {error && (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
        </div>
        <div className="feedback" role="status">
          {notice && (
            <MessageBar intent="success">
              <MessageBarBody>{notice}</MessageBarBody>
            </MessageBar>
          )}
        </div>
        {!loaded ? (
          <div className="loading">Loading workspace…</div>
        ) : !user ? (
          <section className="login-panel">
            <h1>Sign in to Supplier Studio</h1>
            <p>Review supplier documents and record your decisions.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                act(async () => {
                  const result = await api("/login", {
                    method: "POST",
                    body: JSON.stringify(Object.fromEntries(data)),
                  });
                  setUser(result.user);
                  await refresh();
                });
              }}
            >
              <Field label="Username" required>
                <Input
                  name="username"
                  defaultValue="reviewer"
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="Password" required>
                <Input
                  name="password"
                  type="password"
                  defaultValue="local-review-only"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Button appearance="primary" type="submit" disabled={busy}>
                Enter demo workspace
              </Button>
            </form>
            <p className="helper">
              Local demo credentials shown for convenience. Synthetic documents
              only. One shared reviewer workspace.
            </p>
          </section>
        ) : (
          <div className="workbench">
            <aside className="queue" aria-label="Application queue">
              <div className="queue-heading">
                <h2>Applications</h2>
                <span className="count">{cases.length}</span>
              </div>
              <div className="case-list">
                {cases.map((c) => (
                  <Button
                    appearance="subtle"
                    className={`case-option ${selected === c.id ? "active" : ""}`}
                    key={c.id}
                    aria-pressed={selected === c.id}
                    onClick={() => {
                      setSelected(c.id);
                      setCorrections({});
                      setReason("");
                      setSource(null);
                      setCitation(null);
                      setNotice("");
                    }}
                  >
                    <span className="case-name">{c.name}</span>
                    <span className="case-meta">
                      <span>Application {String(c.id).padStart(3, "0")}</span>
                      <Status value={c.status} />
                    </span>
                  </Button>
                ))}
              </div>
              <form
                className="new-case"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const name = new FormData(form).get("name");
                  act(async () => {
                    const c = await api("/cases", {
                      method: "POST",
                      body: JSON.stringify({ name }),
                    });
                    setCases((items) => [c, ...items]);
                    setSelected(c.id);
                    setCorrections({});
                    setReason("");
                    setSource(null);
                    setCitation(null);
                    form.reset();
                  });
                }}
              >
                <Field label="New supplier">
                  <Input
                    name="name"
                    placeholder="Supplier name…"
                    maxLength={160}
                    required
                  />
                </Field>
                <Button
                  appearance="primary"
                  icon={<Add20Regular />}
                  type="submit"
                  disabled={busy}
                >
                  Create application
                </Button>
              </form>
              <div className="queue-footer">
                {sandboxMode
                  ? "Changes are saved in this browser."
                  : "One shared reviewer workspace."}
              </div>
            </aside>
            {current ? (
              <div className="case-workspace">
                <section
                  className="evidence-pane"
                  aria-labelledby="case-heading"
                >
                  <div className="case-heading">
                    <div>
                      <h1 id="case-heading">{current.name}</h1>
                      <div className="case-summary">
                        <span>
                          <DocumentText20Regular aria-hidden="true" />
                          {current.documents.length} documents
                        </span>
                        <span>
                          {unresolvedCount}{" "}
                          {unresolvedCount === 1 ? "field" : "fields"} to
                          resolve
                        </span>
                        <span>
                          {current.ready
                            ? "Ready for approval"
                            : "Review required"}
                        </span>
                      </div>
                    </div>
                    <Status value={current.status} />
                  </div>
                  <div className="document-tabs" aria-label="Documents">
                    {current.documents.map((d) => (
                      <Button
                        appearance="subtle"
                        className={source === d.id ? "selected" : ""}
                        key={d.id}
                        aria-pressed={source === d.id}
                        onClick={() => {
                          setSource(source === d.id ? null : d.id);
                          setCitation(null);
                        }}
                      >
                        {d.name}
                      </Button>
                    ))}
                  </div>
                  {selectedDocument ? (
                    <div className="source-view">
                      <div className="source-toolbar">
                        <span>
                          {selectedDocument.kind} ·{" "}
                          {selectedDocument.pages.length} page
                          {selectedDocument.pages.length !== 1
                            ? "s"
                            : ""} · {selectedDocument.mode}
                        </span>
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Dismiss20Regular />}
                          onClick={() => {
                            setSource(null);
                            setCitation(null);
                          }}
                        >
                          Close
                        </Button>
                      </div>
                      <div
                        className="source-pages"
                        tabIndex={0}
                        aria-label={`Source text: ${selectedDocument.name}`}
                      >
                        {selectedDocument.pages.map((text, i) => (
                          <section
                            className="source-page"
                            id={`source-page-${i + 1}`}
                            key={i}
                          >
                            <span className="page-number">Page {i + 1}</span>
                            <SourceText
                              text={text}
                              quote={
                                citation?.document === selectedDocument.id &&
                                citation.page === i + 1
                                  ? citation.quote
                                  : undefined
                              }
                            />
                          </section>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="source-empty">
                      <DocumentText20Regular aria-hidden="true" />
                      <h2>
                        {current.documents.length
                          ? "Select a document"
                          : "No documents yet"}
                      </h2>
                      <p>
                        {current.documents.length
                          ? "Choose a document or a field citation to inspect its source text."
                          : "Add the required document types to start reviewing this supplier."}
                      </p>
                    </div>
                  )}
                  {current.missing_documents.length > 0 && (
                    <MessageBar intent="warning">
                      <MessageBarBody>
                        Required documents missing:{" "}
                        {current.missing_documents.join(", ")}.
                      </MessageBarBody>
                    </MessageBar>
                  )}
                  {current.status === "pending" && (
                    <form
                      className="upload-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const data = new FormData(form);
                        act(async () => {
                          update(
                            await api(`/cases/${current.id}/documents`, {
                              method: "POST",
                              body: data,
                            }),
                          );
                          setCorrections({});
                          form.reset();
                          setNotice(
                            sandboxMode
                              ? "Synthetic fixture added. Previous corrections cleared for review."
                              : "Document extracted. Previous corrections cleared for a fresh evidence review.",
                          );
                        });
                      }}
                    >
                      <Field label="Document type">
                        <Select name="kind">
                          <option value="registration">
                            Registration certificate
                          </option>
                          <option value="bank">Bank confirmation</option>
                          <option value="form">Onboarding form</option>
                        </Select>
                      </Field>
                      {sandboxMode ? (
                        <p className="helper">
                          Adds a bundled synthetic fixture. Real uploads run in
                          the local full-stack app.
                        </p>
                      ) : (
                        <Field
                          label="Choose document"
                          hint="TXT or text-based PDF · 5 MB max"
                        >
                          {(fieldProps) => (
                            <input
                              {...fieldProps}
                              className="file-input"
                              type="file"
                              name="file"
                              accept=".txt,.pdf"
                              required
                            />
                          )}
                        </Field>
                      )}
                      <Button
                        type="submit"
                        icon={<Add20Regular />}
                        disabled={busy}
                      >
                        {sandboxMode
                          ? "Add synthetic fixture"
                          : "Upload & extract"}
                      </Button>
                    </form>
                  )}
                </section>
                <section className="review-pane" aria-label="Review details">
                  <h2>Review details</h2>
                  <p className="review-guidance helper">
                    Corrections are optional and require a reason.
                  </p>
                  <div className="review-fields">
                    {Object.entries(current.fields).map(([key, field]) => (
                      <section className="field-section" key={key}>
                        <div className="field-heading">
                          <h3>{field.label}</h3>
                          <Status value={field.state} />
                        </div>
                        <div className="extracted-value">
                          {field.value || "No evidence found"}
                        </div>
                        <div className="citations">
                          {field.evidence.map((e, i) => (
                            <Button
                              appearance="subtle"
                              className={`citation ${citation?.document === e.document_id && citation.quote === e.quote ? "active" : ""}`}
                              size="small"
                              title={e.quote}
                              aria-label={`Show ${e.document}, page ${e.page}: ${e.quote}`}
                              key={i}
                              onClick={() => {
                                setSource(e.document_id);
                                setCitation({
                                  document: e.document_id,
                                  page: e.page,
                                  quote: e.quote,
                                });
                              }}
                            >
                              <span className="citation-location">
                                {e.document} · p{e.page}
                              </span>
                            </Button>
                          ))}
                        </div>
                        {current.status === "pending" && (
                          <Field
                            className="correction"
                            label={`Correct ${field.label.toLowerCase()}`}
                          >
                            <Input
                              aria-label={`Correct ${field.label}`}
                              value={corrections[key] ?? ""}
                              placeholder={
                                field.value || "Enter verified value…"
                              }
                              maxLength={200}
                              onChange={(e) =>
                                setCorrections((prev) => {
                                  const next = { ...prev };
                                  if (e.target.value)
                                    next[key] = e.target.value;
                                  else delete next[key];
                                  return next;
                                })
                              }
                            />
                          </Field>
                        )}
                      </section>
                    ))}
                  </div>
                  <section
                    className="decision"
                    aria-labelledby="decision-heading"
                  >
                    <h2 id="decision-heading">Human review</h2>
                    {current.status === "pending" ? (
                      <>
                        <Field
                          label="Reason for your decision"
                          hint="Approval requires all document types and resolved fields. Corrections do not alter source documents."
                        >
                          <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Describe the evidence you checked and why this resolution is appropriate…"
                            minLength={5}
                            maxLength={2000}
                            resize="vertical"
                            rows={3}
                          />
                        </Field>
                        <div className="decision-actions">
                          <Button
                            appearance="primary"
                            icon={<Checkmark20Regular />}
                            disabled={busy || reason.trim().length < 5}
                            onClick={() => review("approved")}
                          >
                            Approve supplier
                          </Button>
                          <Button
                            icon={<Save20Regular />}
                            disabled={busy || reason.trim().length < 5}
                            onClick={() => review("save")}
                          >
                            Save corrections
                          </Button>
                          <Button
                            appearance="subtle"
                            icon={<Dismiss20Regular />}
                            disabled={busy || reason.trim().length < 5}
                            onClick={() => review("rejected")}
                          >
                            Reject application
                          </Button>
                        </div>
                      </>
                    ) : (
                      <MessageBar intent="info">
                        <MessageBarBody>
                          This application was {current.status}. Documents and
                          decisions are preserved as a read-only record.
                        </MessageBarBody>
                      </MessageBar>
                    )}
                  </section>
                  <section
                    className="history"
                    aria-labelledby="history-heading"
                  >
                    <h2 id="history-heading">Decision history</h2>
                    <ol>
                      {current.events.map((event, i) => (
                        <li key={i}>
                          <div className="event-heading">
                            <strong>{event.action}</strong>
                            <time dateTime={event.at}>
                              {new Date(event.at).toLocaleString()}
                            </time>
                          </div>
                          <p>
                            {event.details.reason ||
                              event.details.note ||
                              "Recorded in the application audit trail."}
                          </p>
                          <span>{event.actor}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                </section>
              </div>
            ) : (
              <section className="empty-workspace">
                <h1>No application selected</h1>
                <p>
                  Create an application, then upload the three document types.
                </p>
              </section>
            )}
          </div>
        )}
      </main>
    </FluentProvider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
