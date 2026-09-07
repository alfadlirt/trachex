# Trachex Landing Page Copy

---

## Hero

**Headline:**
# Stop reconstructing "who changed this" from memory.

**Subheadline:**
Development Tracking Assistant turns your BRD/FSD and every Slack-message-shaped requirement change into one evidence-backed checklist — so you always know what was asked, what changed, and who said so.

**CTA:** `npx trachex init` — no Docker, no account, bring your own API key.

---

## The Pain

You've been here before:

> "That's not what the requirement said."
> "Who approved this change?"
> "I never said that."

Requirements don't drift because people are careless. They drift because most of the actual change happens in a Teams message, a MoM line, or a "quick UAT note" — never in a document, never versioned, never attributed. By the time something breaks in production, the only record left is memory, and memory loses every time.

You go on leave for a week. You come back to five tickets, half-remembered context, and a Slack thread you have to re-read top to bottom just to remember what you already decided.

This isn't a tooling gap you can fix with more meetings. It's a tracking gap.

---

## The Solution

**Trachex is a development checklist that remembers, so you don't have to.**

Every ticket gets one checklist. It's seeded from your BRD/FSD, and it grows every time something changes — a formal doc revision, or a one-line adjustment you log the moment someone tells you something new:

```
trachex adjustment TICKET-1234 --from "Budi (BA)" --source chat \
  --note "discount cap should be 15%, not 20%, VIP exempt"
```

That's it. No re-typing the whole context into a doc. No hoping you remember it three weeks from now.

---

## How It Works

```
BRD/FSD  ──┐
           ├──▶  Checklist item generated  ──▶  You review, you execute, you check it off
Adjustment ──┘         (grounded in your own coding standards / conventions)

           Doc revised or new adjustment logged?
                    │
                    ▼
        Contradiction detected → old item flagged superseded (never deleted — still evidence)
                    │
                    ▼
        Everything ready to test?
                    │
                    ▼
        One command → Development Summary
        (full timeline, services/APIs/pages impacted, test scenarios)
```

Ask it questions anytime, from your terminal, your agent harness, or the web UI:

> "What changed since last week?"
> "Why does this task exist?"
> "Which APIs are affected?"

You get a grounded answer with a source and a timestamp — not a guess.

---

## The Human Touch — Why This Isn't "AI Doing Your Job"

Trachex doesn't write your code. It doesn't decide anything for you. Every checklist item is checked off by a human, always — because a tracking tool that quietly marks things "done" on your behalf isn't a tracking tool anymore, it's a liability.

What Trachex actually does is smaller and more useful than "AI automation": it **remembers precisely, so your brain doesn't have to** — freeing you up to think about the actual engineering problem instead of reconstructing what was asked six different times across six different threads.

This is also not surveillance. The audit trail exists to protect *you* — the developer — with a record of exactly what was asked and when it changed. It's evidence for you, not a leash.

---

## Who This Is For

**If you're a software engineer who works off a business brief before you write a single line of code** — grooming with a BA, an FSD or BRD landing in your inbox, requirements that get "adjusted" mid-sprint by someone who never re-issues the doc — this is built for exactly that rhythm. Not for teams that spec everything in code comments and ship same-day. For everyone else who's ever been blamed for a requirement nobody wrote down.

---

## Value, Plainly

- **Evidence over memory** — every change has a source, a timestamp, and (if it came from a person) a name attached.
- **Context survives interruption** — go on leave, switch tickets, come back weeks later — the checklist is exactly where you left it.
- **One clean artifact at the end** — a Development Summary that answers "what happened on this ticket" without you writing it by hand.
- **Your data, your model** — bring your own API key, run it locally with SQLite, no subscription, no vendor lock-in.
- **Works with what you already use** — MCP-native from day one, so it plugs into your agent harness of choice instead of demanding you adopt a new one.

---

## Positioning — Not Another Spec-to-Code Tool

Tools like Kiro, GitHub Spec Kit, and BMAD help an agent build the right thing from a spec. That's a different job. **Trachex doesn't write code — it's the record of what was actually asked, what changed, and who said so.** Point any of those tools at Trachex's baseline instead of re-explaining your ticket from scratch every session; Trachex's job stops at "here's what's true and who said it," everything downstream is still yours.

---

## Open Source, Vendor-Agnostic, Yours

- BYOK: Anthropic, OpenAI, Gemini, or a local model — your choice, your key, never logged by Trachex.
- Local-first by default (SQLite) — a personal VPS if you want persistence across machines. No forced cloud, no forced team plan.
- Full source available — inspect it, fork it, run it exactly the way you want.

---

## Closing CTA

**You already do the work of tracking requirement changes in your head. Let something else hold that memory for you.**

```
npx trachex init
```
