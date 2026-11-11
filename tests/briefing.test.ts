import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { accountContext } from "../lib/account-context";
import { agentTools, cleanBriefingNotes } from "../lib/agent";
import { resetDb } from "../lib/db";

test("briefing notes keep only known circles, one each, with clamped text and a valid urgency", () => {
  const ids = new Set(["ubuntu", "soweto"]);
  const notes = cleanBriefingNotes(
    {
      notes: [
        { club_id: "ubuntu", urgency: "handled", did: "  Reminded Thandiwe in Ndebele. ", next: "Step in after 14 Nov." },
        { club_id: "ubuntu", urgency: "needs_you", did: "duplicate", next: "" },
        { club_id: "someone-elses-circle", urgency: "needs_you", did: "x", next: "y" },
        { club_id: "soweto", urgency: "panic", did: 42, next: "x".repeat(500) },
      ],
    },
    ids,
  );
  assert.deepEqual(notes.map((n) => n.clubId), ["ubuntu", "soweto"]);
  assert.equal(notes[0].did, "Reminded Thandiwe in Ndebele.");
  assert.equal(notes[0].urgency, "handled");
  assert.equal(notes[1].urgency, "nothing", "unknown urgency falls back to nothing");
  assert.equal(notes[1].did, "", "non-string text is dropped");
  assert.equal(notes[1].next.length, 280, "long text is clamped");
});

test("malformed briefing input yields no notes", () => {
  for (const raw of [null, undefined, "text", { notes: "nope" }, { notes: [null, 3] }]) {
    assert.deepEqual(cleanBriefingNotes(raw, new Set(["a"])), []);
  }
});

test("submit_briefing is never exposed outside briefing runs (e.g. over MCP)", () => {
  process.env.ACCOUNT_DATA_DIR = path.join(mkdtempSync(path.join(tmpdir(), "rotapot-briefing-")), "accounts");
  accountContext.run({ id: "briefing-test", name: "Test" }, () => {
    resetDb();
    assert.ok(!agentTools().some((t) => t.name === "submit_briefing"));
  });
});

test("fillPayLink substitutes the placeholder and only appends when asked", async () => {
  const { fillPayLink } = await import("../lib/agent");
  assert.equal(fillPayLink("Pay here {{PAY_LINK}} ok {{PAY_LINK}}", "https://x/p", false), "Pay here https://x/p ok https://x/p");
  assert.equal(fillPayLink("No placeholder", "https://x/p", false), "No placeholder");
  assert.equal(fillPayLink("No placeholder", "https://x/p", true), "No placeholder\nhttps://x/p");
});
