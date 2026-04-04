# Phonix Inference Template

Confidential LLM inference running privately inside a Trusted Execution Environment (TEE) on Acurast smartphone nodes.

## What this does

- Deploys to 3 Acurast processor nodes (configurable in `phonix.json`)
- Listens for prompts via WebSocket
- Calls any OpenAI-compatible inference API (Ollama, vLLM, OpenAI, etc.)
- Returns results privately — neither the device owner nor Acurast can inspect your prompts or responses

## Quick deploy

```bash
# 1. Initialise credentials (if you haven't already)
phonix auth acurast

# 2. Set your inference endpoint in .env
echo "INFERENCE_API_URL=https://your-inference-endpoint" >> .env
echo "INFERENCE_API_KEY=your_api_key" >> .env   # omit for local Ollama
echo "INFERENCE_MODEL=llama3" >> .env

# 3. Test locally first
phonix run-local

# 4. Deploy
phonix deploy

# 5. Send a prompt
phonix send <processorId> '{"prompt":"Summarize: The quick brown fox...","requestId":"1"}'
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `INFERENCE_API_URL` | `http://localhost:11434` | Base URL of your inference API |
| `INFERENCE_API_KEY` | *(empty)* | API key — leave empty for local Ollama |
| `INFERENCE_MODEL` | `llama3` | Model name to use |

Set these in `phonix.json` under `environment` (injected at bundle time):

```json
{
  "environment": {
    "INFERENCE_API_URL": "https://your-endpoint",
    "INFERENCE_MODEL": "llama3"
  }
}
```

> **Note:** `INFERENCE_API_KEY` should stay in `.env` only — never put secrets in `phonix.json`.

## `phonix.json` configuration

| Field | Default | Description |
|---|---|---|
| `replicas` | 3 | Number of processor nodes |
| `schedule.durationMs` | 86400000 | Deployment lifetime (24h) |
| `maxCostPerExecution` | 1000000 | Max cost in microACU |

## Supported inference backends

The template targets the OpenAI-compatible `/v1/chat/completions` endpoint, which works with:

| Backend | URL |
|---|---|
| [Ollama](https://ollama.com) | `http://localhost:11434` (use ngrok/cloudflared for HTTPS) |
| [OpenAI](https://platform.openai.com) | `https://api.openai.com` |
| [vLLM](https://github.com/vllm-project/vllm) | `https://your-vllm-server` |
| Any OpenAI-compatible API | `https://your-endpoint` |

## Calling from your dApp

```typescript
import { PhonixClient } from '@phonix/sdk';

const client = new PhonixClient({
  provider: 'acurast',
  secretKey: process.env.PHONIX_SECRET_KEY,
});

await client.connect();

client.onMessage((msg) => {
  const { requestId, result, model } = msg.payload as {
    requestId: string;
    result: string;
    model: string;
  };
  console.log(`[${requestId}] ${model}: ${result}`);
});

// Get processor IDs from `phonix status`
await client.send('0xproc...', {
  requestId: 'req-001',
  model: 'llama3',        // optional — overrides INFERENCE_MODEL
  prompt: 'Summarize: The quick brown fox...',
});

client.disconnect();
```

## Message format

**Request** (sent to processor):
```json
{ "requestId": "req-001", "prompt": "Your prompt here", "model": "llama3" }
```

**Response** (received from processor):
```json
{ "requestId": "req-001", "result": "The model's response...", "model": "llama3", "timestamp": 1712345678000 }
```

**Error response**:
```json
{ "requestId": "req-001", "error": "LLM API error: ..." }
```
