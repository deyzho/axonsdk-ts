/**
 * CloudflareMessagingClient — HTTP-based messaging with Cloudflare Workers.
 *
 * Cloudflare Workers expose a public `.workers.dev` URL. Axon uses:
 *   POST /message  → deliver a payload; response body is the result
 *   GET  /health   → liveness probe
 *
 * Security:
 *  - Only https:// endpoints are permitted
 *  - Private/internal IP ranges are blocked (prevents SSRF)
 *  - Response bodies are capped at 4 MiB
 *  - Prototype-polluting keys in remote JSON payloads are rejected
 */

import type { Message } from '../../types.js';
import { AxonError } from '../../types.js';

const PRIVATE_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)$/i;

const MAX_RESULT_BYTES = 4 * 1024 * 1024; // 4 MiB

function assertSafeEndpoint(endpoint: string): void {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new AxonError('cloudflare', `Invalid endpoint URL: "${endpoint}"`);
  }
  if (parsed.protocol !== 'https:') {
    throw new AxonError('cloudflare', `Endpoint must use https:// (got "${parsed.protocol}").`);
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    throw new AxonError('cloudflare', `Endpoint hostname "${parsed.hostname}" is a private/internal address.`);
  }
}

function safeParseJson(str: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(str);
  } catch {
    return str;
  }
  if (parsed !== null && typeof parsed === 'object') {
    for (const key of Object.keys(parsed as object)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new AxonError('cloudflare', `Rejected payload: prototype-polluting key "${key}".`);
      }
    }
  }
  return parsed;
}

export class CloudflareMessagingClient {
  private messageHandlers: Array<(msg: Message) => void> = [];
  private connected = false;
  private apiToken = '';

  async connect(secretKey: string): Promise<void> {
    if (!secretKey || secretKey.trim() === '') {
      throw new AxonError('cloudflare', 'A non-empty API token is required.');
    }
    this.apiToken = secretKey;
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
    this.messageHandlers = [];
    this.apiToken = '';
  }

  async send(workerUrl: string, payload: unknown): Promise<void> {
    if (!this.connected) {
      throw new AxonError('cloudflare', 'Not connected. Call connect() first.');
    }

    assertSafeEndpoint(workerUrl);

    const base = workerUrl.replace(/\/$/, '');
    const messageUrl = `${base}/message`;
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    let response: Response;
    try {
      response = await fetch(messageUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      throw new AxonError('cloudflare', `Failed to reach Worker at ${workerUrl}: ${(err as Error).message}`);
    }

    if (!response.ok) {
      throw new AxonError('cloudflare', `Worker returned ${response.status}: ${await response.text()}`);
    }

    const resultText = await response.text();
    if (resultText.length > MAX_RESULT_BYTES) {
      throw new AxonError('cloudflare', `Worker response exceeded ${MAX_RESULT_BYTES} bytes.`);
    }

    if (resultText?.trim()) {
      const msg: Message = {
        from: workerUrl,
        payload: safeParseJson(resultText),
        timestamp: new Date(),
      };
      for (const handler of this.messageHandlers) handler(msg);
    }
  }

  onMessage(handler: (msg: Message) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  async isLive(workerUrl: string): Promise<boolean> {
    assertSafeEndpoint(workerUrl);
    try {
      const base = workerUrl.replace(/\/$/, '');
      const res = await fetch(`${base}/health`, {
        headers: { 'Authorization': `Bearer ${this.apiToken}` },
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  get isConnected(): boolean { return this.connected; }
}
