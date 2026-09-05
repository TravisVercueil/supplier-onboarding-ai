import { test } from "node:test";
import assert from "node:assert/strict";
import { sandboxApi, resetSandbox } from "../src/sandbox.ts";
const review = (id, data) =>
  sandboxApi(`/cases/${id}/review`, {
    method: "POST",
    body: JSON.stringify(data),
  });

test("sandbox requires resolution before approval and freezes decided cases", async () => {
  resetSandbox();
  const { cases } = await sandboxApi("/cases");
  assert.equal(cases[0].fields.registration_number.state, "conflict");
  await assert.rejects(
    review(1, { decision: "approved", reason: "Checked certificate" }),
    /Resolve every field/,
  );
  const approved = await review(1, {
    decision: "approved",
    reason: "Certificate takes precedence over form typo",
    corrections: { registration_number: "DEMO-2024-001" },
  });
  assert.equal(approved.status, "approved");
  assert.equal(approved.fields.registration_number.state, "resolved");
  assert.equal(approved.events[0].action, "approved");
  await assert.rejects(
    review(1, { decision: "rejected", reason: "Second decision" }),
    /read-only/,
  );
});

test("missing documents block approval even after manual corrections", async () => {
  resetSandbox();
  const c = await sandboxApi("/cases", {
    method: "POST",
    body: JSON.stringify({ name: "Missing pack" }),
  });
  await assert.rejects(
    review(c.id, {
      decision: "approved",
      reason: "Trying to bypass document requirement",
      corrections: {
        supplier_name: "Cedar",
        registration_number: "D1",
        bank_account: "D2",
      },
    }),
    /all three document types/,
  );
  const result = (await sandboxApi("/cases")).cases.find(
    (item) => item.id === c.id,
  );
  assert.equal(result.fields.registration_number.state, "missing");
});

test("adding a fixture clears corrections and retains an audit entry", async () => {
  resetSandbox();
  await review(1, {
    decision: "save",
    reason: "Verified certificate",
    corrections: { registration_number: "DEMO-2024-001" },
  });
  const form = new FormData();
  form.set("kind", "form");
  const result = await sandboxApi("/cases/1/documents", {
    method: "POST",
    body: form,
  });
  assert.equal(result.fields.registration_number.state, "conflict");
  assert.equal(result.events[0].action, "fixture added");
});
