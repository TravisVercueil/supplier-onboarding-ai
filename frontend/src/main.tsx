import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
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
    <>
      <header>
        <a className="brand" href="#main">
          <span className="brand-mark">S</span> Supplier Studio
        </a>
        <div className="header-meta">
          <span className="mode">
            {sandboxMode
              ? "Interactive sandbox · synthetic documents · no live AI calls"
              : mode === "baseline"
                ? "Deterministic demo · no model"
                : "OpenAI extraction"}
          </span>
          {sandboxMode && (
            <button
              className="quiet"
              onClick={() =>
                act(async () => {
                  resetSandbox();
                  setSelected(1);
                  setCorrections({});
                  setReason("");
                  setSource(null);
                  await refresh();
                  setNotice("Sandbox reset to the original synthetic example.");
                })
              }
            >
              Reset demo
            </button>
          )}
          {user && !sandboxMode && (
            <button
              className="quiet"
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
            </button>
          )}
        </div>
      </header>
      <main id="main">
        <div role="alert">{error && <p className="error">{error}</p>}</div>
        <div role="status">{notice && <p className="notice">{notice}</p>}</div>
        {!loaded ? (
          <p>Loading workspace…</p>
        ) : !user ? (
          <section className="login">
            <p className="eyebrow">EVIDENCE BEFORE APPROVAL</p>
            <h1>
              Good suppliers.
              <br />
              Clear decisions.
            </h1>
            <p>
              Review the evidence, resolve contradictions, and keep a record of
              every decision.
            </p>
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
              <label>
                Username
                <input
                  name="username"
                  defaultValue="reviewer"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  defaultValue="local-review-only"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button disabled={busy}>Enter demo workspace →</button>
            </form>
            <p className="small">
              Local demo credentials shown for convenience. Synthetic documents
              only. One shared reviewer workspace.
            </p>
          </section>
        ) : (
          <>
            <section className="intro">
              <div>
                <p className="eyebrow">SUPPLIER OPERATIONS / REVIEW DESK</p>
                <h1>Evidence, then confidence.</h1>
                <p>
                  Every extracted field has a source. Every decision has a
                  human.
                </p>
              </div>
              <div className="workspace-tag">
                <span className="dot" />{" "}
                {sandboxMode ? "Browser-local sandbox" : "Local demo workspace"}
              </div>
            </section>
            <div className="workspace">
              <aside>
                <div className="section-heading">
                  <h2>Applications</h2>
                  <span>{cases.length.toString().padStart(2, "0")}</span>
                </div>
                <div className="case-list">
                  {cases.map((c) => (
                    <button
                      className={`case-option ${selected === c.id ? "active" : ""}`}
                      key={c.id}
                      onClick={() => {
                        setSelected(c.id);
                        setCorrections({});
                        setReason("");
                        setSource(null);
                        setNotice("");
                      }}
                    >
                      <span>{c.name}</span>
                      <small>
                        {c.status === "pending" ? "Awaiting review" : c.status}
                      </small>
                    </button>
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
                      form.reset();
                    });
                  }}
                >
                  <label>
                    New supplier
                    <input
                      name="name"
                      placeholder="Supplier name"
                      maxLength={160}
                      required
                    />
                  </label>
                  <button className="secondary" disabled={busy}>
                    + Create application
                  </button>
                </form>
                <div className="aside-note">
                  <strong>A deliberately difficult example</strong>
                  <p>
                    Cedar Works has conflicting registration numbers. Compare
                    the certificate with the form, then record your resolution.
                  </p>
                </div>
              </aside>
              {current ? (
                <section className="review">
                  <div className="case-heading">
                    <div>
                      <p className="eyebrow">
                        APPLICATION {String(current.id).padStart(3, "0")}
                      </p>
                      <h2>{current.name}</h2>
                    </div>
                    <span className={`badge ${current.status}`}>
                      {current.status === "pending"
                        ? "Needs review"
                        : current.status}
                    </span>
                  </div>
                  <div className="summary">
                    <div>
                      <strong>{current.documents.length}</strong>
                      <span>Documents received</span>
                    </div>
                    <div>
                      <strong>
                        {
                          Object.values(current.fields).filter((f) =>
                            ["missing", "conflict"].includes(f.state),
                          ).length
                        }
                      </strong>
                      <span>Fields to resolve</span>
                    </div>
                    <div>
                      <strong>{current.ready ? "Ready" : "Review"}</strong>
                      <span>Approval readiness</span>
                    </div>
                  </div>
                  <section>
                    <div className="section-heading">
                      <h3>01 / Document pack</h3>
                      <span>TXT or text-based PDF · 5 MB max</span>
                    </div>
                    <div className="documents">
                      {current.documents.map((d) => (
                        <button
                          className={`document ${source === d.id ? "selected" : ""}`}
                          key={d.id}
                          onClick={() =>
                            setSource(source === d.id ? null : d.id)
                          }
                        >
                          <span className="file-icon">↗</span>
                          <span>
                            <strong>{d.name}</strong>
                            <small>
                              {d.kind} · {d.pages.length} page
                              {d.pages.length !== 1 ? "s" : ""} · {d.mode}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                    {source &&
                      current.documents
                        .filter((d) => d.id === source)
                        .map((d) => (
                          <div className="source" key={d.id}>
                            <div className="section-heading">
                              <h4>Source text · {d.name}</h4>
                              <button
                                className="quiet"
                                onClick={() => setSource(null)}
                              >
                                Close
                              </button>
                            </div>
                            {d.pages.map((p, i) => (
                              <div key={i}>
                                <small>PAGE {i + 1}</small>
                                <pre>{p}</pre>
                              </div>
                            ))}
                          </div>
                        ))}
                    {current.missing_documents.length > 0 && (
                      <p className="warning">
                        Required documents missing:{" "}
                        {current.missing_documents.join(", ")}.
                      </p>
                    )}
                    {current.status === "pending" && (
                      <form
                        className="upload"
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
                        <label>
                          Document type
                          <select name="kind">
                            <option value="registration">
                              Registration certificate
                            </option>
                            <option value="bank">Bank confirmation</option>
                            <option value="form">Onboarding form</option>
                          </select>
                        </label>
                        {sandboxMode ? (
                          <p className="small">
                            Adds a bundled synthetic fixture. Real uploads run
                            in the local full-stack app.
                          </p>
                        ) : (
                          <label>
                            Choose document
                            <input
                              type="file"
                              name="file"
                              accept=".txt,.pdf"
                              required
                            />
                          </label>
                        )}
                        <button className="secondary" disabled={busy}>
                          {sandboxMode
                            ? "Add synthetic fixture"
                            : "Upload & extract"}
                        </button>
                      </form>
                    )}
                  </section>
                  <section>
                    <div className="section-heading">
                      <h3>02 / Extracted evidence</h3>
                      <span>Compare before correcting</span>
                    </div>
                    {Object.entries(current.fields).map(([key, field]) => (
                      <article className="field" key={key}>
                        <div className="field-top">
                          <h4>{field.label}</h4>
                          <span className={`badge ${field.state}`}>
                            {field.state}
                          </span>
                        </div>
                        <strong className="field-value">
                          {field.value || "No evidence found"}
                        </strong>
                        <div className="evidence-list">
                          {field.evidence.map((e, i) => (
                            <button
                              className="evidence"
                              key={i}
                              onClick={() => {
                                setSource(e.document_id);
                                document
                                  .querySelector(".documents")
                                  ?.scrollIntoView({
                                    behavior: "instant",
                                    block: "start",
                                  });
                              }}
                            >
                              <q>{e.quote}</q>
                              <small>
                                {e.document} · page {e.page} ↗
                              </small>
                            </button>
                          ))}
                        </div>
                        {current.status === "pending" && (
                          <label className="correction">
                            Reviewer correction{" "}
                            <span>(optional; requires a reason below)</span>
                            <input
                              aria-label={`Correct ${field.label}`}
                              value={corrections[key] ?? ""}
                              placeholder={
                                field.value || "Enter verified value"
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
                          </label>
                        )}
                      </article>
                    ))}
                  </section>
                  <section className="decision">
                    <h3>03 / Human review</h3>
                    {current.status === "pending" ? (
                      <>
                        <label>
                          Reason for your decision
                          <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Describe the evidence you checked and why this resolution is appropriate…"
                            minLength={5}
                            maxLength={2000}
                          />
                        </label>
                        <p className="small">
                          Approval requires all document types and resolved
                          fields. Corrections do not alter source documents.
                        </p>
                        <div className="actions">
                          <button
                            disabled={busy || reason.trim().length < 5}
                            onClick={() => review("approved")}
                          >
                            Approve supplier
                          </button>
                          <button
                            className="secondary"
                            disabled={busy || reason.trim().length < 5}
                            onClick={() => review("save")}
                          >
                            Save corrections
                          </button>
                          <button
                            className="quiet danger"
                            disabled={busy || reason.trim().length < 5}
                            onClick={() => review("rejected")}
                          >
                            Reject application
                          </button>
                        </div>
                      </>
                    ) : (
                      <p>
                        This application was {current.status}. Documents and
                        decisions are preserved as a read-only record.
                      </p>
                    )}
                  </section>
                  <section className="audit">
                    <h3>04 / Decision history</h3>
                    {current.events.map((e, i) => (
                      <div className="event" key={i}>
                        <span className="event-dot" />
                        <div>
                          <strong>{e.action}</strong>
                          <p>
                            {e.details.reason ||
                              e.details.note ||
                              "Recorded in the application audit trail."}
                          </p>
                          <small>
                            {e.actor} · {new Date(e.at).toLocaleString()}
                          </small>
                        </div>
                      </div>
                    ))}
                  </section>
                </section>
              ) : (
                <section className="empty">
                  <h2>Your review desk is ready.</h2>
                  <p>
                    Create an application, then upload the three document types.
                  </p>
                </section>
              )}
            </div>
          </>
        )}
      </main>
      <footer>
        <span>Supplier Studio / Built by Travis Vercueil</span>
        <span>Synthetic data. Human decisions. Traceable evidence.</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
