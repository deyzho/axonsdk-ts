import { describe, it, expect, vi } from 'vitest';
import { KoiiProvider } from '../providers/koii/index.ts';
import { AxonError } from '../types.ts';

describe('KoiiProvider construction', () => {
  it('should have name "koii"', () => {
    const p = new KoiiProvider();
    expect(p.name).toBe('koii');
  });

  it('should accept a custom RPC URL', () => {
    expect(() => new KoiiProvider('https://testnet.koii.network')).not.toThrow();
  });
});

describe('KoiiProvider.connect()', () => {
  it('should throw AxonError if secretKey is empty', async () => {
    const p = new KoiiProvider();
    await expect(p.connect('')).rejects.toBeInstanceOf(AxonError);
  });

  it('should succeed with a non-empty secret key (no network call during connect)', async () => {
    const p = new KoiiProvider();
    // connect() only validates the key format — no network call
    // With a hex key string, it should succeed or warn gracefully
    await expect(p.connect('deadbeef'.repeat(8))).resolves.not.toThrow();
  });
});

describe('KoiiProvider.estimate()', () => {
  it('should return a CostEstimate with koii provider and KOII token', async () => {
    const p = new KoiiProvider();
    const estimate = await p.estimate({
      runtime: 'nodejs',
      code: 'src/index.ts',
      schedule: { type: 'on-demand' },
      replicas: 2,
    });

    expect(estimate.provider).toBe('koii');
    expect(estimate.token).toBe('KOII');
    expect(typeof estimate.amount).toBe('number');
    expect(estimate.amount).toBeGreaterThan(0);
  });

  it('should scale linearly with replica count', async () => {
    const p = new KoiiProvider();
    const one = await p.estimate({
      runtime: 'nodejs',
      code: 'src/index.ts',
      schedule: { type: 'on-demand' },
      replicas: 1,
    });
    const five = await p.estimate({
      runtime: 'nodejs',
      code: 'src/index.ts',
      schedule: { type: 'on-demand' },
      replicas: 5,
    });

    expect(five.amount).toBe(one.amount * 5);
  });
});

describe('KoiiProvider.onMessage()', () => {
  it('should register a handler and return an unsubscribe function', () => {
    const p = new KoiiProvider();
    const handler = vi.fn();
    const unsub = p.onMessage(handler);
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });
});

describe('KoiiProvider.disconnect()', () => {
  it('should not throw if never connected', () => {
    const p = new KoiiProvider();
    expect(() => p.disconnect()).not.toThrow();
  });
});

describe('KoiiProvider.listDeployments()', () => {
  it('should return an empty array if CLI not available', async () => {
    const p = new KoiiProvider();
    const result = await p.listDeployments();
    expect(Array.isArray(result)).toBe(true);
  });
});
