# Phonix Next.js Example

A minimal Next.js app demonstrating how to use `@phonix/sdk` to call a confidential inference endpoint running on Acurast smartphone nodes.

## Setup

### 1. Deploy the inference template

```bash
cd ../../templates/inference
phonix auth acurast   # one-time credential setup
phonix deploy
# Copy the processor ID from the output
```

### 2. Configure environment variables

Create `.env.local` in this directory:

```bash
# Your P256 private key — keep this server-side in production
PHONIX_SECRET_KEY=your_secret_key_hex

# Processor ID from `phonix deploy` or `phonix status`
PROCESSOR_ID=0xabc...your_processor_id
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
Browser (Next.js)
    │
    │  PhonixClient from '@phonix/sdk'
    │
    ├── connect(secretKey)
    │      ↓
    │   wss://ws-1.ws-server-1.acurast.com  (Acurast relay)
    │      ↓
    │   Processor (smartphone TEE)
    │
    ├── send(processorId, { prompt })
    │      ↓
    │   TEE runs inference privately
    │      ↓
    └── onMessage((msg) => display result)
```

## Security notes

- In this example the secret key is server-side (API route / Server Component). Keep it there — never expose it to the browser.
- For production, use a Next.js API Route or Server Action to proxy calls through your backend.

## Using the SDK in your own Next.js project

```typescript
// app/api/phonix/send/route.ts  (Next.js App Router)
import { PhonixClient } from '@phonix/sdk';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const client = new PhonixClient({
    provider: 'acurast',
    secretKey: process.env.PHONIX_SECRET_KEY,
  });

  await client.connect();

  let result: string | null = null;

  const unsubscribe = client.onMessage((msg) => {
    const payload = msg.payload as { result?: string };
    result = payload.result ?? null;
  });

  await client.send(process.env.PROCESSOR_ID!, { requestId: crypto.randomUUID(), prompt });

  // Allow time for the response to arrive
  await new Promise((r) => setTimeout(r, 5_000));

  unsubscribe();
  client.disconnect();

  return NextResponse.json({ result });
}
```
