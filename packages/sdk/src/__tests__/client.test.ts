import { describe, it, expect } from 'vitest';
import { AxonClient } from '../client.ts';
import { AxonError } from '../types.ts';
import { AcurastProvider } from '../providers/acurast/index.ts';
import { FluenceProvider } from '../providers/fluence/index.ts';
import { KoiiProvider } from '../providers/koii/index.ts';
import { AkashProvider } from '../providers/akash/index.ts';

describe('AxonClient constructor', () => {
  it('should default to the acurast provider', () => {
    const client = new AxonClient({ secretKey: 'dummy' });
    expect(client.providerName).toBe('acurast');
  });

  it('should select fluence provider when specified', () => {
    const client = new AxonClient({ provider: 'fluence', secretKey: 'dummy' });
    expect(client.providerName).toBe('fluence');
  });

  it('should select koii provider when specified', () => {
    const client = new AxonClient({ provider: 'koii', secretKey: 'dummy' });
    expect(client.providerName).toBe('koii');
  });

  it('should select akash provider when specified', () => {
    const client = new AxonClient({ provider: 'akash', secretKey: 'dummy' });
    expect(client.providerName).toBe('akash');
  });

  it('should use PHONIX_SECRET_KEY env var if secretKey not provided', () => {
    const original = process.env['PHONIX_SECRET_KEY'];
    process.env['PHONIX_SECRET_KEY'] = 'env-secret-key';
    try {
      const client = new AxonClient();
      expect(client.providerName).toBe('acurast'); // just checking it constructs
    } finally {
      if (original === undefined) {
        delete process.env['PHONIX_SECRET_KEY'];
      } else {
        process.env['PHONIX_SECRET_KEY'] = original;
      }
    }
  });
});

describe('AxonClient.connect()', () => {
  it('should throw AxonError if no secret key is available', async () => {
    const original = process.env['PHONIX_SECRET_KEY'];
    delete process.env['PHONIX_SECRET_KEY'];
    try {
      const client = new AxonClient({ secretKey: '' });
      await expect(client.connect()).rejects.toBeInstanceOf(AxonError);
    } finally {
      if (original !== undefined) {
        process.env['PHONIX_SECRET_KEY'] = original;
      }
    }
  });
});

describe('Provider selection', () => {
  it('AcurastProvider should have name "acurast"', () => {
    const p = new AcurastProvider();
    expect(p.name).toBe('acurast');
  });

  it('FluenceProvider should have name "fluence"', () => {
    const p = new FluenceProvider();
    expect(p.name).toBe('fluence');
  });

  it('KoiiProvider should have name "koii"', () => {
    const p = new KoiiProvider();
    expect(p.name).toBe('koii');
  });

  it('AkashProvider should have name "akash"', () => {
    const p = new AkashProvider();
    expect(p.name).toBe('akash');
  });
});

describe('Provider implementations are real (not stubs)', () => {
  it('FluenceProvider should return a CostEstimate (not throw NotImplemented)', async () => {
    const p = new FluenceProvider();
    await expect(
      p.estimate({ runtime: 'nodejs', code: '', schedule: { type: 'on-demand' } })
    ).resolves.toMatchObject({ provider: 'fluence', token: 'FLT' });
  });

  it('FluenceProvider.listDeployments() should return an array', async () => {
    const p = new FluenceProvider();
    await expect(p.listDeployments()).resolves.toBeInstanceOf(Array);
  });

  it('KoiiProvider should return a CostEstimate (not throw NotImplemented)', async () => {
    const p = new KoiiProvider();
    await expect(
      p.estimate({ runtime: 'nodejs', code: '', schedule: { type: 'on-demand' } })
    ).resolves.toMatchObject({ provider: 'koii', token: 'KOII' });
  });

  it('KoiiProvider.listDeployments() should return an array', async () => {
    const p = new KoiiProvider();
    await expect(p.listDeployments()).resolves.toBeInstanceOf(Array);
  });

  it('FluenceProvider.onMessage() should return an unsubscribe function', () => {
    const p = new FluenceProvider();
    const unsub = p.onMessage(() => {});
    expect(typeof unsub).toBe('function');
  });

  it('KoiiProvider.onMessage() should return an unsubscribe function', () => {
    const p = new KoiiProvider();
    const unsub = p.onMessage(() => {});
    expect(typeof unsub).toBe('function');
  });

  it('AkashProvider should return a CostEstimate', async () => {
    const p = new AkashProvider();
    await expect(
      p.estimate({ runtime: 'nodejs', code: '', schedule: { type: 'on-demand', durationMs: 3_600_000 } })
    ).resolves.toMatchObject({ provider: 'akash', token: 'AKT' });
  });

  it('AkashProvider.listDeployments() should return an array', async () => {
    const p = new AkashProvider();
    await expect(p.listDeployments()).resolves.toBeInstanceOf(Array);
  });

  it('AkashProvider.onMessage() should return an unsubscribe function', () => {
    const p = new AkashProvider();
    const unsub = p.onMessage(() => {});
    expect(typeof unsub).toBe('function');
  });
});

describe('AxonClient.disconnect()', () => {
  it('should not throw if not connected', () => {
    const client = new AxonClient({ secretKey: 'dummy' });
    expect(() => client.disconnect()).not.toThrow();
  });

  it('should not throw for fluence client if not connected', () => {
    const client = new AxonClient({ provider: 'fluence', secretKey: 'dummy' });
    expect(() => client.disconnect()).not.toThrow();
  });

  it('should not throw for koii client if not connected', () => {
    const client = new AxonClient({ provider: 'koii', secretKey: 'dummy' });
    expect(() => client.disconnect()).not.toThrow();
  });

  it('should not throw for akash client if not connected', () => {
    const client = new AxonClient({ provider: 'akash', secretKey: 'dummy' });
    expect(() => client.disconnect()).not.toThrow();
  });
});
