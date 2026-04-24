# AxonSDK Roadmap

Priorities may shift based on community feedback and provider availability. This roadmap reflects the TypeScript monorepo ([`deyzho/axonsdk-ts`](https://github.com/deyzho/axonsdk-ts)). The Python SDK ([`deyzho/axonsdk`](https://github.com/deyzho/axonsdk)) has its own companion roadmap.

Dates are targets, not commitments. Each release will ship when its acceptance criteria are met.

---

## v0.3 — Shipped (2026-04)

All ten compute providers implemented; runtime rename from the legacy `phonix` global to `axon` finalised; full Apache-2.0 relicense.

### Providers
- io.net — GPU clusters (A100, H100, RTX), job submission, HTTP messaging
- Akash Network — container deployments via SDL + IPFS bundle distribution, HTTP lease messaging
- Acurast — full deploy, TEE messaging, runtime adapter
- Fluence — deploy via CLI, P2P messaging
- Koii — deploy via CLI, HTTP task-node messaging
- AWS — Lambda and ECS/Fargate via boto3
- Google Cloud — Cloud Run and Cloud Functions
- Azure — Container Instances and Functions
- Cloudflare Workers — Workers with AI Gateway integration
- Fly.io — Fly Machines

### SDK, CLI, and mobile
- Provider-agnostic runtime bootstrap (`globalThis.axon` injected at bundle time)
- `axon auth` — interactive credential wizard for all providers
- `axon run-local` — local mock runtime with SSRF and DNS rebinding protection
- `@axonsdk/inference` — OpenAI-compatible inference handler with latency-based routing
- `@axonsdk/mobile` — React Native / Expo SDK with `useAxon`, `useMessages`, `useSend` hooks, `AxonProvider` context, and iOS Keychain / Android Keystore backed `SecureKeyStorage`
- Inference + Oracle templates

### Quality and security
- SSRF protection, DNS rebinding defence, prototype pollution prevention, response caps, path-traversal guards, `chmod 600` on secrets
- Supply-chain hardening — SBOM per build, npm `--provenance` on publish, OIDC Trusted Publishing for PyPI
- Full test suite — 314+ tests across SDK, inference, mobile, and CLI

---

## v0.4 — Operator UX (target: 2026-Q3)

**Theme: deployed workloads are only useful if operators can see and steer them.**

- [ ] **`axon logs <id>`** — stream processor stdout and runtime events from deployed scripts
- [ ] **`axon update <id>`** — redeploy an existing deployment with new code, preserving routing config
- [ ] **`axon stop <id>`** — cancel an active deployment cleanly (alias for `teardown`)
- [ ] **Persistent leases** — auto-renew and monitor long-running deployments
- [ ] **Dashboard** — minimal web UI for managing deployments and viewing routing analytics across providers
- [ ] **Coverage report** — enforce coverage thresholds in CI (target: 85% for sdk, 80% across the monorepo)

### Acceptance criteria for v0.4
- All four new commands have integration tests against at least one real provider sandbox
- Dashboard reads directly from provider APIs (no new server-side state)
- Coverage threshold gate added to `.github/workflows/publish.yml`

---

## v0.5 — Provider trust (target: 2026-Q4)

**Theme: enterprise adoption requires proof the integrations actually work.**

- [ ] **Live provider CI** — integration tests against provider sandboxes in GitHub Actions, gated on release (not every PR, for cost reasons)
- [ ] **Provider health dashboard** at `status.axonsdk.dev` — real latency, error rates, and circuit-breaker state, populated from production synthetic workloads
- [ ] **`axon template publish`** — allow community members to publish templates to a shared registry
- [ ] **Template marketplace** — browse and install community templates via `axon template install <name>`

### Acceptance criteria for v0.5
- At least one real production workload running against each of the ten providers for ≥30 days
- `status.axonsdk.dev` publishes uptime and latency history (not just current state)
- Template registry has at least five community-contributed templates

---

## v0.6 — LLM routing (target: 2027-Q1)

**Theme: unify the LLM client layer so the SDK answers "where should this request run" at the model level, not just the compute level.**

- [ ] **`@axonsdk/llm`** — unified LLM client routing across Claude, Gemini, GPT-4, open-source, and self-hosted models
- [ ] **Multi-provider deploy** — deploy to multiple providers simultaneously with a single command
- [ ] **Bring your own model** — route to self-hosted open-source models on your own compute alongside hosted APIs
- [ ] **Streaming-first** — SSE streaming becomes the default across all inference routes; non-streaming is an explicit flag

---

## v1.0 — Production-ready (target: 2027-Q2)

**Theme: make the 1.0 promise credible. No breaking changes after this without a major bump.**

### Hard requirements before v1.0 is cut
1. **All ten providers have green integration tests** running in CI against provider sandboxes at least weekly
2. **At least one named reference customer** per cloud (AWS / GCP / Azure / Cloudflare / Fly.io), willing to be quoted
3. **Deprecation policy in effect**: any API removed between v1.0 and v2.0 must have been `@deprecated` with a console warning for at least one minor version
4. **Documentation site live** at `docs.axonsdk.dev` with full API reference, guides, and a working migration page from `0.x` → `1.0`
5. **Semver-strict commitment** documented in the README and enforced by CI via an exported-types-stability check
6. **Zero `any` leaks** in the public API surface of `@axonsdk/sdk` (verified via a dedicated tsc check)
7. **Security audit** — third-party review of the runtime bootstrap, provider adapters, and secret-handling paths

### The v1.0 release itself
- [ ] Drop all `0.x.*` deprecated surfaces in a single breaking release
- [ ] Publish a migration guide covering every renamed or removed API from the `0.x` line
- [ ] Tag a `v1.0.0-rc.1` at least 4 weeks before `v1.0.0` to give downstream time to test

---

## Long-term (post-1.0, no timeline)

- **SLA routing** — route based on latency SLA targets, not just current metrics
- **Cost analytics** — per-request cost breakdown and optimisation recommendations across providers
- **Python runtime support** — deploy Python scripts to all providers that support it (partial today, full parity post-1.0)
- **VSCode extension** — inline cost estimates, one-click deploy, and provider health indicators
- **AxonSDK-native observability** — OpenTelemetry instrumentation across the SDK with per-provider spans

---

## Versioning policy

AxonSDK follows [Semantic Versioning 2.0](https://semver.org/spec/v2.0.0.html). See [`CONTRIBUTING.md`](./CONTRIBUTING.md#versioning-policy) for the full breaking-change policy.

Short version:
- **`0.x.y`** (current) — minor bumps may contain breaking changes, each documented with a `Changed — Breaking` + `Migration` section in `CHANGELOG.md`.
- **`≥1.0`** (target 2027-Q2) — breaking changes require a major bump; deprecations are announced one minor version before removal.

The public API is the exported surface of `@axonsdk/sdk`, the `axon` CLI commands, the `@axonsdk/inference` `handleRequest` signature, the `@axonsdk/mobile` hooks and provider, and the runtime-bootstrap `globalThis.axon` contract. Breaking changes to any of these will be called out in the CHANGELOG and Release notes.
