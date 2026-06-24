# AxonSDK — Strategy & Positioning

**Status:** Working strategy (v1, 2026)
**Audience:** Maintainers, contributors, and future-self via Claude Code
**Purpose:** Define what AxonSDK is, what it is deliberately *not*, and the order
in which to build so the project develops a moat instead of becoming a thin,
clonable router.

---

## TL;DR

> **AxonSDK is the reliable inference layer for DePIN compute — with cloud fallback built in.**

- **Spear (the wedge):** DePIN / edge / TEE compute (Acurast first). This is where
  the market is early, fragmented, under-aggregated, and where our integrations are
  already a head start.
- **Shield (the safety net):** A small number of cloud/serverless backends used as
  automatic **fallback** when edge nodes are slow, unavailable, or fail quality checks.
- **The moat (what makes it defensible):** A **quality & verification layer** that
  measures whether distributed inference output is actually correct, and routes on
  that signal — not just on cost/latency/availability.

We are **not** trying to be a universal LLM API router. That lane is taken
(OpenRouter, LiteLLM) and commoditizing. Competing there means being a
worse-resourced follower. We win by owning the quadrant nobody else does the
unglamorous work in: aggregating and *quality-assuring* DePIN inference.

---

## The strategic problem this doc resolves

AxonSDK today is a comprehensive scaffold: ten providers integrated breadth-first,
all treated as co-equal, with light real-world testing. Two risks follow from that:

1. **"Everything to everyone."** Ten co-equal providers is breadth without depth.
   Breadth is the scaffold's weakness, not the product's strength.
2. **Drifting into the cloud-router knife-fight.** A universal "route across OpenAI,
   Gemini, GPT-4, cloud GPUs" framing puts AxonSDK into direct comparison with
   OpenRouter and LiteLLM — on their turf, where we lose and where margins are
   compressing.

This document picks a direction to remove both risks.

---

## Why DePIN-first (and not cloud-first)

These are not two symmetric doors. They are different-shaped markets:

| Dimension | Cloud / LLM-API routing | DePIN / edge / TEE routing |
|-----------|------------------------|----------------------------|
| Competition | Crowded — OpenRouter (funded leader), LiteLLM (OSS default) | Sparse — nobody aggregates it well |
| Our position | Late follower, no edge | Early, with integrations already built |
| Provider incentive toward us | None — they want developers direct | High — they have great infra, poor dev funnel; they *want* an aggregator that brings them users |
| Cost story | Arbitraging pennies; promo discounts evaporate | Structural: idle/underpriced capacity → durable 40–60% cheaper on batch/async |
| Is there a quality problem to own? | No — cloud quality is assumed (OpenAI's API gives OpenAI's model) | **Yes** — random edge nodes, variable quantization, silent failures. Quality is uncertain and **measurable** |

The last row is the most important. **Our only available moat — verified quality
routing — is only valuable in a world where quality is uncertain. That world is
DePIN.** Choosing cloud as the center of gravity would mean abandoning the one
defensible asset we can build.

### Growth thesis
- DePIN networks will **co-market and partner** with an aggregator that drives them
  developers. We can ride their token-incentivized growth machines. Cloud providers
  will not.
- The compute-scarcity macro (AI demand outrunning data-center buildout) pushes
  batch/async overflow toward exactly the edge capacity we aggregate.
- Being the **default aggregation-plus-quality layer** for DePIN inference *as that
  market grows* is worth more than being one more cloud router in a market that's
  already mature.

### The honest tradeoff
DePIN-first means a **smaller immediate market** than "universal AI router." Fewer
developers shop for edge inference *today* than for OpenAI alternatives. This is a
bet on a growing niche where we can be the default, over a grab at a large existing
market where we'd be a follower. Given the cloud-router lane is already lost, this is
the correct bet — but make it with eyes open.

---

## The two-tier provider model

Cloud is **not** a separate strategy. It's the hierarchical safety net that makes the
DePIN wedge usable in production. Developers will only trust edge inference if there
is a guaranteed fallback.

```
        ┌─────────────────────────────────────────────┐
        │  DEVELOPER REQUEST (OpenAI-compatible call)  │
        └───────────────────────┬─────────────────────┘
                                │
                ┌───────────────▼────────────────┐
                │   TIER 1 — DePIN / edge / TEE   │   ← the value proposition
                │   (cheap, verifiable, primary)  │      route here first
                │   Acurast (anchor) + 1–2 others │
                └───────────────┬────────────────┘
                                │  unavailable / slow / fails quality check
                ┌───────────────▼────────────────┐
                │   TIER 2 — Cloud fallback       │   ← the insurance
                │   (reliable, boring, secondary) │      1–2 providers only
                │   one strong cloud backend      │
                └─────────────────────────────────┘
```

- **Tier 1 — DePIN (the value proposition):** 2–3 backends that are genuinely good and
  production-hardened. Anchor on **Acurast** (most traction, TEE story). Add **one or
  two** others only where the integration actually works end-to-end.
- **Tier 2 — Cloud (the insurance):** **One or two** cloud/serverless backends, present
  purely as automatic failover. We already have the circuit-breaker/failover machinery
  for this. Cloud is the floor that makes Tier 1 trustworthy — not a headline.

**Everything else on the current ten-provider list gets demoted** to `experimental` or
removed from the supported set. Breadth was the scaffold; a sharp two-tier set is the
product.

---

## The moat: verified quality routing

Every network and router today routes on **cost, latency, and availability**. Nobody
routes on **quality**, because nobody has the measurement layer.

- TEE attestation (Acurast's pitch) proves *code ran unmodified on genuine hardware*.
- It does **not** prove the model produced a *correct, high-quality* output — e.g. a
  good embedding vs. a subtly broken one from a misquantized build on a random node.

That gap is real, technically hard, and **unowned**. Closing it is what turns a thin
router into something with a wall around it.

### What to build (the quality layer)
1. **Canary tasks** — inject known-answer requests (sampled %) per provider/model/region;
   detect nodes returning wrong/garbage/cached output.
2. **Cross-provider consensus** — on a sampled fraction of real requests, run on 2+
   backends and compare outputs (semantic similarity for text, vector distance for
   embeddings) to catch silent quality divergence.
3. **Reliability scoring** — per-provider, per-model, per-region rolling quality +
   uptime + latency score, persisted as history (not just current state).
4. **Quality-aware routing strategy** — a new strategy alongside `cost`/`latency`:
   `quality` (and `balanced` factors quality in). Route to the *best* verified backend,
   not merely the cheapest live one.

### Why this is defensible
- **Hard to clone:** the value is the accumulated quality/reliability dataset across
  providers — a history a fresh competitor doesn't have.
- **Compounds with usage:** more traffic → better measurements → better routing →
  more traffic. The flywheel a pure router lacks.
- **Plausibly (narrowly) patentable:** "verifiable quality routing for distributed
  inference" is a specific technical mechanism that improves how the system operates —
  the kind of claim that can clear the post-2025 USPTO software/AI bar, unlike
  "route to the cheapest GPU."

---

## What AxonSDK is NOT (explicit boundaries)

To keep the positioning sharp, AxonSDK deliberately does **not**:

- **Try to be OpenRouter / LiteLLM.** No competing as a universal hosted-LLM API
  router. Cloud LLM APIs are fallback plumbing, not the headline product.
- **Treat all providers as co-equal.** Two tiers, deliberately small. DePIN primary,
  cloud secondary, everything else experimental or cut.
- **Run its own compute fleet.** We are the layer *above* the networks. Acurast et al.
  are **suppliers, not competitors.** (This is the lesson from the PhoneGrid analysis:
  do not enter the supply-side war.)
- **Lead with DePIN as the developer pitch.** Developers want *cheap, reliable
  inference*. DePIN is our supply-side advantage; the pitch is price + reliability,
  with verifiable quality as the differentiator.

---

## Build sequence (what to harden first)

> Narrow the scaffold before extending it. Depth on the few that matter beats breadth.

**Phase A — Narrow & harden (do this first)**
1. Designate the supported set: **Acurast (anchor)** + 1–2 DePIN backends + 1 cloud
   fallback. Mark all other providers `experimental`.
2. Make the supported set genuinely production-grade: real integration tests against
   live sandboxes, not mocks. Green CI weekly per supported provider.
3. Wire the **cloud fallback** explicitly beneath the DePIN tier using the existing
   circuit-breaker/failover machinery. Prove failover end-to-end.

**Phase B — Build the moat**
4. Ship **canary tasks** on the supported providers.
5. Ship **per-provider/model/region reliability scoring** with persisted history
   (extend `status.axonsdk.dev` to publish quality history, not just uptime).
6. Add the **`quality` routing strategy** and fold quality into `balanced`.

**Phase C — Selective expansion**
7. Add **cross-provider consensus** sampling for high-value request classes.
8. Only then consider adding back additional providers — each must pass the same
   production-grade bar before leaving `experimental`.

### Concrete deliverables (folded into the phases)

This strategy is the single source of truth for direction. The concrete shippable
work below is mapped onto the phases above — each item is reframed around the
**supported set**, never the old ten-provider breadth (which is now an explicit
non-goal).

**Phase A — operability of the supported set**
- **`axon logs <id>`** — stream processor stdout and runtime events from deployed scripts.
- **`axon update <id>`** — redeploy existing code, preserving routing config.
- **`axon stop <id>`** — cancel an active deployment cleanly (alias for `teardown`).
- **Persistent leases** — auto-renew and monitor long-running deployments.
- **Dashboard** — minimal web UI for managing deployments and viewing routing analytics.
  Reads directly from provider APIs; no new server-side state.
- **Coverage gate in CI** — enforce thresholds (target: 85% sdk, 80% monorepo) in
  `.github/workflows/publish.yml`.

**Phase B — the quality moat as the on-ramp**
- This was the old "Provider trust" theme, and it is the **highest-leverage** work — it
  is the on-ramp to the moat. Already covered by canary tasks, reliability scoring, and
  the `quality` strategy above. `status.axonsdk.dev` publishes quality *and* uptime
  history, not just current state.
- **Template publishing / marketplace** (`axon template publish` / `install <name>`) —
  community templates, scoped to the supported providers.

**Phase C — fallback plumbing and selective expansion**
- **`@axonsdk/llm`** — a unified LLM client is fine *only as fallback plumbing*. It must
  **not** reposition AxonSDK as a universal hosted-LLM router (the OpenRouter/LiteLLM
  lane we explicitly avoid).
- **Streaming-first** — SSE becomes the default across inference routes; non-streaming
  is an explicit flag.

**Toward 1.0 (gating requirements, reframed)**
- **All *supported* providers green** in CI against sandboxes at least weekly — *not*
  "all ten."
- At least one named **reference customer** for the cloud fallback, willing to be quoted.
- **Deprecation policy in effect**: anything removed between 1.0 and 2.0 was `@deprecated`
  with a console warning for ≥1 minor version.
- **Docs site live** at `docs.axonsdk.dev` — full API reference, guides, `0.x → 1.0` migration.
- **Semver-strict** commitment enforced by an exported-types-stability check.
- **Zero `any` leaks** in the public API surface of `@axonsdk/sdk`.
- **Security audit** of the runtime bootstrap, provider adapters, and secret-handling paths.

**Later (post-1.0, no timeline)**
- SLA routing · cost analytics · full Python runtime parity · VSCode extension ·
  OpenTelemetry observability with per-provider spans.

Versioning policy lives in [`CONTRIBUTING.md`](../CONTRIBUTING.md#versioning-policy).

---

## One-line positioning (use everywhere)

> **AxonSDK — the reliable inference layer for DePIN compute, with cloud fallback built in.**
> DePIN is the spear. Cloud is the shield. Verified quality is the moat.
