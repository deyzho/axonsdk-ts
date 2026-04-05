# @phonixsdk/cli

> Command-line tool for deploying and managing Phonix edge applications across DePIN networks.

[![npm](https://img.shields.io/npm/v/@phonixsdk/cli)](https://www.npmjs.com/package/@phonixsdk/cli)
[![license](https://img.shields.io/npm/l/@phonixsdk/cli)](./LICENSE)

## Installation

```bash
npm install -g @phonixsdk/cli
```

Requires **Node.js ≥ 20**.

## Commands

| Command | Description |
|---|---|
| `phonix init` | Interactive project setup — generates `phonix.json`, `.env`, and template files |
| `phonix auth [provider]` | Credential wizard — generates and stores provider keys securely |
| `phonix deploy` | Bundle, upload to IPFS, and register your deployment on-chain |
| `phonix run-local` | Run your script locally with a full mock provider runtime |
| `phonix status` | List deployments, processor IDs, and live status |
| `phonix send <id> <msg>` | Send a test message directly to a processor node |

## Quick start

```bash
# 1. Create a new project
phonix init

# 2. Set up credentials for your chosen provider
phonix auth acurast    # or: akash | fluence | koii

# 3. Test locally before spending tokens
phonix run-local

# 4. Deploy to the network
phonix deploy

# 5. Check your deployment
phonix status

# 6. Send a test message
phonix send <deployment-id> '{"prompt":"Hello"}'
```

## Supported providers

| Provider | Auth command | Requires |
|---|---|---|
| **Acurast** | `phonix auth acurast` | Polkadot wallet mnemonic, IPFS endpoint |
| **Akash Network** | `phonix auth akash` | Cosmos wallet mnemonic |
| **Fluence** | `phonix auth fluence` | Fluence wallet |
| **Koii** | `phonix auth koii` | Koii wallet keypair |

## Documentation

Full docs at [phonix.dev](https://phonix.dev) · [GitHub](https://github.com/deyzho/phonix)

## License

Apache-2.0 © [Phonix](https://phonix.dev)
