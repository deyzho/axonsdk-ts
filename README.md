# Phonix SDK

**Build edge dApps once. Run them confidentially on millions of smartphones — no servers, no headaches.**

Phonix is the unified developer platform for building and deploying confidential edge applications across decentralised compute networks. It abstracts the complexity of multiple DePIN providers behind a single, consistent API — starting with [Acurast](https://acurast.com) (237k+ smartphone TEE nodes) and expanding to Fluence and Koii.

> Phonix is to edge compute what Ethers.js is to EVM chains: **one interface, any provider**.

---

## Supported providers

| Provider | Status | Nodes | Runtime |
|---|---|---|---|
| [Acurast](https://acurast.com) | ✅ Supported | 237k+ smartphones | nodejs, wasm |
| [Fluence](https://fluence.network) | ✅ Supported | Decentralised cloud | nodejs |
| [Koii](https://koii.network) | ✅ Supported | Community compute | nodejs |

---

## Quick start

### 1. Install the CLI

```bash
npm install -g @phonix/cli
```

### 2. Initialise a new project

```bash
mkdir my-edge-app && cd my-edge-app
phonix init
```

This will prompt you for a project name, provider, and template (inference / oracle / blank), then generate `phonix.json`, `.env`, and `src/index.ts`.

### 3. Configure credentials

```bash
phonix auth
```

The interactive wizard generates and stores all required keys and endpoints for your chosen provider. Your `.env` is automatically added to `.gitignore` and locked to owner-only permissions.

### 4. Test locally

```bash
phonix run-local
```

Runs your script in a local mock environment — simulates WebSocket messages, real HTTPS requests, and the provider runtime API without touching the network.

### 5. Deploy

```bash
phonix deploy
```

Bundles your script, uploads it to IPFS, and registers the deployment on-chain.

```
✔ Deployment live!
  Deployment ID: 0xabc123...
  Processors:    3 matched
    • 0xproc1...
    • 0xproc2...
    • 0xproc3...
```

### 6. Call from your dApp

```typescript
import { PhonixClient } from '@phonix/sdk';

const client = new PhonixClient({
  provider: 'acurast',
  secretKey: process.env.PHONIX_SECRET_KEY,
});

await client.connect();

client.onMessage((msg) => {
  const { result } = msg.payload as { result: string };
  console.log('Result:', result);
});

await client.send('0xproc1...', {
  requestId: 'req-001',
  prompt: 'Summarize: The quick brown fox...',
});

client.disconnect();
```

---

## CLI reference

| Command | Description |
|---|---|
| `phonix init` | Interactive setup — generates `phonix.json`, `.env`, and template files |
| `phonix auth [provider]` | Credential wizard — generates and stores keys for the selected provider |
| `phonix deploy` | Bundle, upload to IPFS, and register deployment |
| `phonix run-local` | Run your script locally with a mock provider runtime |
| `phonix status` | List deployments, processor IDs, and live status |
| `phonix send <id> <msg>` | Send a test message to a processor node |
| `phonix template list` | Show available built-in templates |

---

## SDK reference

```typescript
import { PhonixClient } from '@phonix/sdk';
import type { DeploymentConfig } from '@phonix/sdk';

const client = new PhonixClient({
  provider: 'acurast',           // 'acurast' | 'fluence' | 'koii'
  secretKey: process.env.PHONIX_SECRET_KEY,
});

await client.connect();

// Estimate cost before deploying
const cost = await client.estimate({
  runtime: 'nodejs',
  code: './dist/index.js',
  schedule: { type: 'on-demand', durationMs: 86_400_000 },
  replicas: 3,
});
console.log(`Estimated: ${cost.amount} ${cost.token}`);

// Deploy
const deployment = await client.deploy({
  runtime: 'nodejs',
  code: './dist/index.js',
  schedule: { type: 'on-demand', durationMs: 86_400_000 },
  replicas: 3,
});

// List deployments
const deployments = await client.listDeployments();

// Send a message to a processor
await client.send(deployment.processorIds[0], { prompt: 'Hello' });

// Receive results
const unsubscribe = client.onMessage((msg) => {
  console.log(msg.payload);
});

client.disconnect();
```

---

## Templates

| Template | Description |
|---|---|
| [`inference`](./templates/inference) | Confidential LLM inference — receive prompts, call an OpenAI-compatible API, return results privately inside a TEE |
| [`oracle`](./templates/oracle) | Data oracle — fetch external data on a schedule, sign it inside the TEE, push to on-chain destinations |
| `blank` | Empty project with full provider runtime type declarations |

---

## `phonix.json` reference

```json
{
  "projectName": "my-edge-app",
  "provider": "acurast",
  "runtime": "nodejs",
  "entryFile": "src/index.ts",
  "schedule": {
    "type": "on-demand",
    "durationMs": 86400000
  },
  "replicas": 3,
  "maxCostPerExecution": 1000000,
  "environment": {
    "MY_VAR": "my-value"
  },
  "destinations": []
}
```

| Field | Type | Description |
|---|---|---|
| `projectName` | `string` | Human-readable project name |
| `provider` | `acurast \| fluence \| koii` | Target compute provider |
| `runtime` | `nodejs \| python \| docker \| wasm` | Execution runtime |
| `entryFile` | `string` | Path to your script entry point |
| `schedule.type` | `on-demand \| interval \| onetime` | When the script runs |
| `schedule.intervalMs` | `number` | Milliseconds between runs (interval only) |
| `schedule.durationMs` | `number` | Total deployment lifetime in ms |
| `replicas` | `number` | Number of processor nodes |
| `maxCostPerExecution` | `number` | Cost cap per run (in provider micro-units) |
| `environment` | `object` | Key-value pairs injected into your script at bundle time |
| `destinations` | `string[]` | On-chain addresses to push results to |

---

## Project structure

```
phonix/
├── packages/
│   ├── cli/          # @phonix/cli — command-line tool
│   └── sdk/          # @phonix/sdk — core library
├── templates/
│   ├── inference/    # Confidential LLM inference
│   └── oracle/       # Data oracle
└── examples/
    └── nextjs-app/   # Example Next.js integration
```

---

## Development

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/phonix.git
cd phonix

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Watch mode during development
cd packages/sdk && npm run dev
```

### Running tests

```bash
cd packages/sdk
npx vitest run
```

Tests cover config loading and validation, runtime bootstrap generation for all providers, provider client construction, cost estimation, message handler registration, and disconnect lifecycle.

---

## Security

Phonix is designed to protect both developers and end users:

- **Secrets never leave `.env`** — the auth wizard generates keys locally and stores them with `chmod 600`. They are never logged or transmitted.
- **esbuild injection guard** — the deploy pipeline rejects any `environment` key that looks like a secret (`_KEY`, `_SECRET`, `_TOKEN`, `_MNEMONIC`, `_PASSWORD`) to prevent accidental bundle-time embedding of credentials.
- **SSRF protection** — all HTTP calls (IPFS upload, Koii task nodes, mock runtime) validate URLs against a private-IP blocklist and enforce HTTPS.
- **DNS rebinding defence** — the local mock runtime resolves hostnames to IPs via `dns.lookup()` before opening any TCP connection, then re-validates the resolved IP against the blocklist.
- **Prototype pollution prevention** — remote JSON payloads are parsed with key blocklisting (`__proto__`, `constructor`, `prototype`) and `phonix.json` environment maps use `Object.create(null)`.
- **Response size caps** — all provider clients enforce a 1 MiB cap on remote responses; the mock runtime enforces a 4 MiB cap on HTTP bodies.

---

## Contributing

Pull requests are welcome. To get started:

1. Fork the repo and create a feature branch
2. Make your changes with tests
3. Run `npm test` and ensure all tests pass
4. Open a pull request with a clear description

High-impact areas:
- Integration tests against Acurast testnet
- Additional provider support (Bacalhau, Render Network)
- Template marketplace

---

## License

MIT — see [LICENSE](./LICENSE).

---

*Phonix is not affiliated with Acurast, Fluence, or Koii. Provider names and trademarks belong to their respective owners.*
