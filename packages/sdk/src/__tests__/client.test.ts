import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxonClient } from '../client.ts';
import { AxonError } from '../types.ts';
import { AcurastProvider } from '../providers/acurast/index.ts';
import { FluenceProvider } from '../providers/fluence/index.ts';
import { KoiiProvider } from '../providers/koii/index.ts';
import { AkashProvider } from '../providers/akash/index.ts';
import { IoNetProvider } from '../providers/ionet/index.ts';
import { AwsProvider } from '../providers/aws/index.ts';
import { GcpProvider } from '../providers/gcp/index.ts';
import { AzureProvider } from '../providers/azure/index.ts';
import { CloudflareProvider } from '../providers/cloudflare/index.ts';
import { FlyioProvider } from '../providers/flyio/index.ts';

// ─── Constructor / provider selection ────────────────────────────────────────

describe('AxonClient constructor — provider selection', () => {
  it('defaults to acurast', () => {
    expect(new AxonClient({ secretKey: 'dummy' }).providerName).toBe('acurast');
  });

  it.each([
    ['acurast',    'acurast'],
    ['fluence',    'fluence'],
    ['koii',       'koii'],
    ['akash',      'akash'],
    ['ionet',      'ionet'],
    ['aws',        'aws'],
    ['gcp',        'gcp'],
    ['azure',      'azure'],
    ['cloudflare', 'cloudflare'],
    ['flyio',      'flyio'],
  ] as const)('selects %s provider', (provider, expected) => {
    const client = new AxonClient({ provider, secretKey: 'dummy' });
    expect(client.providerName).toBe(expected);
  });
});

// ─── Provider name properties ─────────────────────────────────────────────────

describe('Provider .name properties', () => {
  it.each([
    [new AcurastProvider(),    'acurast'],
    [new FluenceProvider(),    'fluence'],
    [new KoiiProvider(),       'koii'],
    [new AkashProvider(),      'akash'],
    [new IoNetProvider(),      'ionet'],
    [new AwsProvider(),        'aws'],
    [new GcpProvider(),        'gcp'],
    [new AzureProvider(),      'azure'],
    [new CloudflareProvider(), 'cloudflare'],
    [new FlyioProvider(),      'flyio'],
  ])('%s has correct name', (provider, expected) => {
    expect(provider.name).toBe(expected);
  });
});

// ─── Secret key / env var fallback ───────────────────────────────────────────

describe('AxonClient — secret key resolution', () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env['AXON_SECRET_KEY'];
    delete process.env['AXON_SECRET_KEY'];
  });

  afterEach(() => {
    if (savedKey === undefined) {
      delete process.env['AXON_SECRET_KEY'];
    } else {
      process.env['AXON_SECRET_KEY'] = savedKey;
    }
  });

  it('uses AXON_SECRET_KEY env var when secretKey option is omitted', async () => {
    process.env['AXON_SECRET_KEY'] = 'env-secret';
    // connect() should not throw the "no secret key" error when env var is set
    const client = new AxonClient();
    // We can't fully connect without a real provider, but we can verify it
    // doesn't throw the empty-key guard by mocking the provider.connect call
    const connectSpy = vi.spyOn(
      (client as unknown as { provider: { connect: (k: string) => Promise<void> } }).provider,
      'connect'
    ).mockResolvedValue(undefined);
    await client.connect();
    expect(connectSpy).toHaveBeenCalledWith('env-secret');
  });

  it('throws AxonError if no secretKey and env var is absent', async () => {
    const client = new AxonClient({ secretKey: '' });
    await expect(client.connect()).rejects.toBeInstanceOf(AxonError);
  });

  it('throws AxonError if secretKey is empty string even with env var unset', async () => {
    const client = new AxonClient({ secretKey: '' });
    await expect(client.connect()).rejects.toThrow(/secret key/i);
  });
});

// ─── connect() ───────────────────────────────────────────────────────────────

describe('AxonClient.connect()', () => {
  it('delegates to provider.connect() with the secret key', async () => {
    const client = new AxonClient({ secretKey: 'test-key' });
    const connectSpy = vi.spyOn(
      (client as unknown as { provider: { connect: (k: string) => Promise<void> } }).provider,
      'connect'
    ).mockResolvedValue(undefined);
    await client.connect();
    expect(connectSpy).toHaveBeenCalledWith('test-key');
  });

  it('sets connected state to true after successful connect', async () => {
    const client = new AxonClient({ secretKey: 'test-key' });
    vi.spyOn(
      (client as unknown as { provider: { connect: (k: string) => Promise<void> } }).provider,
      'connect'
    ).mockResolvedValue(undefined);
    await client.connect();
    expect((client as unknown as { connected: boolean }).connected).toBe(true);
  });

  it('throws AxonError on empty secretKey', async () => {
    const client = new AxonClient({ secretKey: '' });
    await expect(client.connect()).rejects.toBeInstanceOf(AxonError);
  });
});

// ─── disconnect() ────────────────────────────────────────────────────────────

describe('AxonClient.disconnect()', () => {
  it('does not throw when not connected', () => {
    const client = new AxonClient({ secretKey: 'dummy' });
    expect(() => client.disconnect()).not.toThrow();
  });

  it.each(['fluence', 'koii', 'akash', 'ionet', 'aws', 'gcp', 'azure', 'cloudflare', 'flyio'] as const)(
    'does not throw for %s when not connected',
    (provider) => {
      const client = new AxonClient({ provider, secretKey: 'dummy' });
      expect(() => client.disconnect()).not.toThrow();
    }
  );

  it('resets connected state to false', async () => {
    const client = new AxonClient({ secretKey: 'test-key' });
    vi.spyOn(
      (client as unknown as { provider: { connect: (k: string) => Promise<void>; disconnect: () => void } }).provider,
      'connect'
    ).mockResolvedValue(undefined);
    vi.spyOn(
      (client as unknown as { provider: { connect: (k: string) => Promise<void>; disconnect: () => void } }).provider,
      'disconnect'
    ).mockImplementation(() => {});
    await client.connect();
    client.disconnect();
    expect((client as unknown as { connected: boolean }).connected).toBe(false);
  });

  it('calls provider.disconnect() exactly once when connected', async () => {
    const client = new AxonClient({ secretKey: 'test-key' });
    const inner = (client as unknown as { provider: { connect: (k: string) => Promise<void>; disconnect: () => void } }).provider;
    vi.spyOn(inner, 'connect').mockResolvedValue(undefined);
    const disconnectSpy = vi.spyOn(inner, 'disconnect').mockImplementation(() => {});
    await client.connect();
    client.disconnect();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('does not call provider.disconnect() when never connected', () => {
    const client = new AxonClient({ secretKey: 'dummy' });
    const disconnectSpy = vi.spyOn(
      (client as unknown as { provider: { disconnect: () => void } }).provider,
      'disconnect'
    ).mockImplementation(() => {});
    client.disconnect();
    expect(disconnectSpy).not.toHaveBeenCalled();
  });
});

// ─── send() — processorId validation ─────────────────────────────────────────

describe('AxonClient.send() — processorId validation', () => {
  let client: AxonClient;

  beforeEach(() => {
    client = new AxonClient({ secretKey: 'dummy' });
    // Mock provider.send so we can reach validation without a real connection
    vi.spyOn(
      (client as unknown as { provider: { send: (id: string, p: unknown) => Promise<void> } }).provider,
      'send'
    ).mockResolvedValue(undefined);
  });

  it('throws AxonError for empty processorId', async () => {
    await expect(client.send('', { data: 1 })).rejects.toBeInstanceOf(AxonError);
  });

  it('throws AxonError for processorId exceeding 512 characters', async () => {
    const longId = 'a'.repeat(513);
    await expect(client.send(longId, { data: 1 })).rejects.toBeInstanceOf(AxonError);
    await expect(client.send(longId, {})).rejects.toThrow(/512/);
  });

  it('accepts a processorId of exactly 512 characters', async () => {
    const maxId = 'a'.repeat(512);
    await expect(client.send(maxId, {})).resolves.toBeUndefined();
  });

  it('throws AxonError for processorId with null byte', async () => {
    await expect(client.send('proc\x00id', {})).rejects.toBeInstanceOf(AxonError);
  });

  it('throws AxonError for processorId with control characters', async () => {
    await expect(client.send('proc\x1fid', {})).rejects.toBeInstanceOf(AxonError);
    await expect(client.send('proc\tid', {})).rejects.toBeInstanceOf(AxonError);
  });

  it('throws AxonError for path traversal sequences (../)', async () => {
    await expect(client.send('../etc/passwd', {})).rejects.toBeInstanceOf(AxonError);
    await expect(client.send('..\\windows\\system32', {})).rejects.toBeInstanceOf(AxonError);
  });

  it('throws AxonError for processorId with forward slash', async () => {
    await expect(client.send('proc/id', {})).rejects.toBeInstanceOf(AxonError);
  });

  it('accepts a valid hex public key', async () => {
    const hexId = '0x' + 'a1b2c3d4'.repeat(8);
    await expect(client.send(hexId, {})).resolves.toBeUndefined();
  });

  it('accepts a domain-style identifier', async () => {
    await expect(client.send('processor-01.acurast.network', {})).resolves.toBeUndefined();
  });
});

// ─── send() — payload size enforcement ───────────────────────────────────────

describe('AxonClient.send() — payload size', () => {
  it('throws AxonError when payload exceeds default 1 MiB limit', async () => {
    const client = new AxonClient({ secretKey: 'dummy' });
    vi.spyOn(
      (client as unknown as { provider: { send: (id: string, p: unknown) => Promise<void> } }).provider,
      'send'
    ).mockResolvedValue(undefined);
    const bigPayload = { data: 'x'.repeat(1024 * 1024 + 1) };
    await expect(client.send('valid-proc-id', bigPayload)).rejects.toBeInstanceOf(AxonError);
    await expect(client.send('valid-proc-id', bigPayload)).rejects.toThrow(/bytes/i);
  });

  it('accepts payload well under the default limit', async () => {
    const client = new AxonClient({ secretKey: 'dummy' });
    vi.spyOn(
      (client as unknown as { provider: { send: (id: string, p: unknown) => Promise<void> } }).provider,
      'send'
    ).mockResolvedValue(undefined);
    // 512 KiB — clearly under the 1 MiB default
    const data = 'x'.repeat(512 * 1024);
    await expect(client.send('valid-proc-id', { data })).resolves.toBeUndefined();
  });

  it('respects a custom maxPayloadBytes option', async () => {
    const client = new AxonClient({ secretKey: 'dummy', maxPayloadBytes: 100 });
    vi.spyOn(
      (client as unknown as { provider: { send: (id: string, p: unknown) => Promise<void> } }).provider,
      'send'
    ).mockResolvedValue(undefined);
    await expect(client.send('proc', { data: 'x'.repeat(101) })).rejects.toBeInstanceOf(AxonError);
    await expect(client.send('proc', { data: 'x'.repeat(50) })).resolves.toBeUndefined();
  });

  it('delegates valid payload to provider.send()', async () => {
    const client = new AxonClient({ secretKey: 'dummy' });
    const sendSpy = vi.spyOn(
      (client as unknown as { provider: { send: (id: string, p: unknown) => Promise<void> } }).provider,
      'send'
    ).mockResolvedValue(undefined);
    const payload = { prompt: 'Hello' };
    await client.send('proc-abc', payload);
    expect(sendSpy).toHaveBeenCalledWith('proc-abc', payload);
  });
});

// ─── onMessage() — trustedProcessorIds filtering ──────────────────────────────

describe('AxonClient.onMessage() — trusted processor filtering', () => {
  it('delivers all messages when trustedProcessorIds is not set', () => {
    const client = new AxonClient({ secretKey: 'dummy' });
    const received: unknown[] = [];
    client.onMessage((msg) => received.push(msg.payload));

    // Simulate provider emitting a message by calling the registered handler
    const inner = (client as unknown as { provider: { onMessage: (h: (m: { from: string; payload: unknown; timestamp: Date }) => void) => () => void } }).provider;
    const registeredHandler = vi.spyOn(inner, 'onMessage').mock.calls[0]?.[0] as
      | ((m: { from: string; payload: unknown; timestamp: Date }) => void)
      | undefined;

    // Re-register to capture handler
    let capturedHandler: ((m: { from: string; payload: unknown; timestamp: Date }) => void) | null = null;
    vi.spyOn(inner, 'onMessage').mockImplementation((h) => {
      capturedHandler = h;
      return () => {};
    });

    const received2: unknown[] = [];
    client.onMessage((msg) => received2.push(msg.payload));

    capturedHandler?.({ from: 'any-proc', payload: 'hello', timestamp: new Date() });
    expect(received2).toContain('hello');
  });

  it('filters out messages from untrusted processors', () => {
    const client = new AxonClient({
      secretKey: 'dummy',
      trustedProcessorIds: ['trusted-proc-1', 'trusted-proc-2'],
    });

    let capturedHandler: ((m: { from: string; payload: unknown; timestamp: Date }) => void) | null = null;
    vi.spyOn(
      (client as unknown as { provider: { onMessage: (h: (m: { from: string; payload: unknown; timestamp: Date }) => void) => () => void } }).provider,
      'onMessage'
    ).mockImplementation((h) => {
      capturedHandler = h;
      return () => {};
    });

    const received: unknown[] = [];
    client.onMessage((msg) => received.push(msg.from));

    capturedHandler?.({ from: 'untrusted-proc', payload: 'evil', timestamp: new Date() });
    expect(received).toHaveLength(0);
  });

  it('delivers messages from trusted processors', () => {
    const client = new AxonClient({
      secretKey: 'dummy',
      trustedProcessorIds: ['trusted-proc-1'],
    });

    let capturedHandler: ((m: { from: string; payload: unknown; timestamp: Date }) => void) | null = null;
    vi.spyOn(
      (client as unknown as { provider: { onMessage: (h: (m: { from: string; payload: unknown; timestamp: Date }) => void) => () => void } }).provider,
      'onMessage'
    ).mockImplementation((h) => {
      capturedHandler = h;
      return () => {};
    });

    const received: string[] = [];
    client.onMessage((msg) => received.push(msg.from));

    capturedHandler?.({ from: 'trusted-proc-1', payload: 'ok', timestamp: new Date() });
    expect(received).toEqual(['trusted-proc-1']);
  });

  it('onMessage() returns a working unsubscribe function', () => {
    const client = new AxonClient({ secretKey: 'dummy' });
    const unsubSpy = vi.fn();
    vi.spyOn(
      (client as unknown as { provider: { onMessage: (h: (m: { from: string; payload: unknown; timestamp: Date }) => void) => () => void } }).provider,
      'onMessage'
    ).mockReturnValue(unsubSpy);

    const unsub = client.onMessage(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
    expect(unsubSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── Provider implementations — all 10 smoke tests ───────────────────────────

describe('Provider implementations — estimate() smoke tests', () => {
  const config = { runtime: 'nodejs', code: '', schedule: { type: 'on-demand' } } as const;

  it('FluenceProvider.estimate() resolves with token FLT', async () => {
    const p = new FluenceProvider();
    await expect(p.estimate(config)).resolves.toMatchObject({ provider: 'fluence', token: 'FLT' });
  });

  it('KoiiProvider.estimate() resolves with token KOII', async () => {
    const p = new KoiiProvider();
    await expect(p.estimate(config)).resolves.toMatchObject({ provider: 'koii', token: 'KOII' });
  });

  it('AkashProvider.estimate() resolves', async () => {
    const p = new AkashProvider();
    await expect(
      p.estimate({ ...config, schedule: { type: 'on-demand', durationMs: 3_600_000 } })
    ).resolves.toMatchObject({ provider: 'akash', token: 'AKT' });
  });

  it('IoNetProvider.estimate() resolves', async () => {
    const p = new IoNetProvider();
    const result = await p.estimate(config);
    expect(result.provider).toBe('ionet');
    expect(typeof result.amount).toBe('number');
  });

  it('AwsProvider.estimate() resolves', async () => {
    const p = new AwsProvider();
    const result = await p.estimate(config);
    expect(result.provider).toBe('aws');
  });

  it('GcpProvider.estimate() resolves', async () => {
    const p = new GcpProvider();
    const result = await p.estimate(config);
    expect(result.provider).toBe('gcp');
  });

  it('AzureProvider.estimate() resolves', async () => {
    const p = new AzureProvider();
    const result = await p.estimate(config);
    expect(result.provider).toBe('azure');
  });

  it('CloudflareProvider.estimate() resolves', async () => {
    const p = new CloudflareProvider();
    const result = await p.estimate(config);
    expect(result.provider).toBe('cloudflare');
  });

  it('FlyioProvider.estimate() resolves', async () => {
    const p = new FlyioProvider();
    const result = await p.estimate(config);
    expect(result.provider).toBe('flyio');
  });
});

describe('Provider implementations — listDeployments() returns arrays', () => {
  it.each([
    ['fluence',    () => new FluenceProvider()],
    ['koii',       () => new KoiiProvider()],
    ['akash',      () => new AkashProvider()],
    ['ionet',      () => new IoNetProvider()],
    ['aws',        () => new AwsProvider()],
    ['gcp',        () => new GcpProvider()],
    ['azure',      () => new AzureProvider()],
    ['cloudflare', () => new CloudflareProvider()],
    ['flyio',      () => new FlyioProvider()],
  ] as const)('%s.listDeployments() returns an array', async (_name, make) => {
    const p = make();
    await expect(p.listDeployments()).resolves.toBeInstanceOf(Array);
  });
});

describe('Provider implementations — onMessage() returns unsubscribe fn', () => {
  it.each([
    ['acurast',    () => new AcurastProvider()],
    ['fluence',    () => new FluenceProvider()],
    ['koii',       () => new KoiiProvider()],
    ['akash',      () => new AkashProvider()],
    ['ionet',      () => new IoNetProvider()],
    ['aws',        () => new AwsProvider()],
    ['gcp',        () => new GcpProvider()],
    ['azure',      () => new AzureProvider()],
    ['cloudflare', () => new CloudflareProvider()],
    ['flyio',      () => new FlyioProvider()],
  ] as const)('%s.onMessage() returns a function', (_name, make) => {
    const p = make();
    const unsub = p.onMessage(() => {});
    expect(typeof unsub).toBe('function');
  });
});
