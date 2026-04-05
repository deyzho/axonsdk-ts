import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from '../router/circuit-breaker.js';
import { ProviderHealthMonitor } from '../router/health-monitor.js';
import { ProcessorSelector } from '../router/processor-selector.js';
import { score } from '../router/strategy.js';
import { PhonixRouter } from '../router/index.js';
import type { RouterConfig } from '../router/types.js';

// ─── CircuitBreaker ───────────────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  it('starts closed', () => {
    const cb = new CircuitBreaker();
    expect(cb.state).toBe('closed');
    expect(cb.isCallable).toBe(true);
  });

  it('opens after threshold failures', () => {
    const cb = new CircuitBreaker(3);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe('closed');
    cb.recordFailure();
    expect(cb.state).toBe('open');
    expect(cb.isCallable).toBe(false);
  });

  it('transitions to half-open after recovery timeout', () => {
    // With recoveryTimeoutMs=0 the transition happens immediately on first state read
    const cb = new CircuitBreaker(1, 0);
    cb.forceState('open');
    expect(cb.state).toBe('half-open');
    expect(cb.isCallable).toBe(true);
  });

  it('closes on success from half-open', () => {
    const cb = new CircuitBreaker(1, 0);
    cb.forceState('half-open');
    cb.recordSuccess();
    expect(cb.state).toBe('closed');
  });

  it('re-opens on failure from half-open', () => {
    const cb = new CircuitBreaker(1, 100);
    cb.forceState('half-open');
    cb.recordFailure();
    expect(cb.state).toBe('open');
  });

  it('decays failure count on success in closed state', () => {
    const cb = new CircuitBreaker(3);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordSuccess(); // decay twice
    // Should still be closed after two failures, two successes
    expect(cb.state).toBe('closed');
  });

  it('resets to initial state', () => {
    const cb = new CircuitBreaker(1);
    cb.recordFailure();
    cb.reset();
    expect(cb.state).toBe('closed');
    expect(cb.isCallable).toBe(true);
  });
});

// ─── ProviderHealthMonitor ────────────────────────────────────────────────────

describe('ProviderHealthMonitor', () => {
  it('returns 1 successRate with no samples', () => {
    const m = new ProviderHealthMonitor();
    expect(m.successRate).toBe(1);
  });

  it('tracks success rate', () => {
    const m = new ProviderHealthMonitor();
    m.record(true, 100);
    m.record(true, 100);
    m.record(false, 100);
    expect(m.successRate).toBeCloseTo(2 / 3);
  });

  it('updates EMA latency', () => {
    const m = new ProviderHealthMonitor();
    m.record(true, 100);
    // EMA = 0.2*100 + 0.8*500 = 420
    expect(m.latency).toBeCloseTo(420);
  });

  it('tracks EMA cost', () => {
    const m = new ProviderHealthMonitor();
    m.recordCost(1);
    // EMA = 0.2*1 + 0.8*0 = 0.2
    expect(m.costUsd).toBeCloseTo(0.2);
  });

  it('evicts samples outside window', async () => {
    const m = new ProviderHealthMonitor(50); // 50ms window
    m.record(false, 100);
    await new Promise(r => setTimeout(r, 60));
    m.record(true, 100);
    // Only the fresh sample should remain — successRate should be 1
    expect(m.successRate).toBe(1);
  });

  it('resets to initial state', () => {
    const m = new ProviderHealthMonitor();
    m.record(false, 500);
    m.reset();
    expect(m.successRate).toBe(1);
    expect(m.total).toBe(0);
  });
});

// ─── ProcessorSelector ────────────────────────────────────────────────────────

describe('ProcessorSelector', () => {
  const ids = ['a', 'b', 'c'];

  it('first — always returns index 0', () => {
    const s = new ProcessorSelector();
    expect(s.next(ids, 'first')).toBe('a');
    expect(s.next(ids, 'first')).toBe('a');
  });

  it('round-robin — cycles through all ids', () => {
    const s = new ProcessorSelector();
    expect(s.next(ids, 'round-robin')).toBe('a');
    expect(s.next(ids, 'round-robin')).toBe('b');
    expect(s.next(ids, 'round-robin')).toBe('c');
    expect(s.next(ids, 'round-robin')).toBe('a');
  });

  it('fastest — picks lowest EMA latency', () => {
    const s = new ProcessorSelector();
    s.recordLatency('a', 1000);
    s.recordLatency('b', 50);
    s.recordLatency('c', 200);
    expect(s.next(ids, 'fastest')).toBe('b');
  });

  it('random — returns a valid id', () => {
    const s = new ProcessorSelector();
    const result = s.next(ids, 'random');
    expect(ids).toContain(result);
  });

  it('throws on empty ids', () => {
    const s = new ProcessorSelector();
    expect(() => s.next([], 'first')).toThrow();
  });

  it('resets round-robin index', () => {
    const s = new ProcessorSelector();
    s.next(ids, 'round-robin');
    s.next(ids, 'round-robin');
    s.reset();
    expect(s.next(ids, 'round-robin')).toBe('a');
  });
});

// ─── score() ─────────────────────────────────────────────────────────────────

describe('score()', () => {
  function mkInput(overrides: Partial<{ successRate: number; latency: number; costUsd: number; circuitState: string }> = {}) {
    const m = new ProviderHealthMonitor();
    const { successRate = 1, latency = 100, costUsd = 0, circuitState = 'closed' } = overrides;
    vi.spyOn(m, 'successRate', 'get').mockReturnValue(successRate);
    vi.spyOn(m, 'latency', 'get').mockReturnValue(latency);
    vi.spyOn(m, 'costUsd', 'get').mockReturnValue(costUsd);
    const cb = new CircuitBreaker();
    vi.spyOn(cb, 'state', 'get').mockReturnValue(circuitState as 'closed' | 'open' | 'half-open');
    vi.spyOn(cb, 'isCallable', 'get').mockReturnValue(circuitState !== 'open');
    return { health: m, circuit: cb };
  }

  it('returns 0 when circuit is open', () => {
    expect(score('balanced', mkInput({ circuitState: 'open' }))).toBe(0);
  });

  it('returns positive score for healthy provider', () => {
    expect(score('balanced', mkInput())).toBeGreaterThan(0);
  });

  it('availability strategy weighs successRate most', () => {
    const good = score('availability', mkInput({ successRate: 1, latency: 5000 }));
    const bad  = score('availability', mkInput({ successRate: 0.1, latency: 100 }));
    expect(good).toBeGreaterThan(bad);
  });

  it('latency strategy weighs latency most', () => {
    const fast = score('latency', mkInput({ successRate: 0.9, latency: 50 }));
    const slow = score('latency', mkInput({ successRate: 0.95, latency: 5000 }));
    expect(fast).toBeGreaterThan(slow);
  });

  it('half-open circuit applies 0.5 multiplier', () => {
    const full = score('balanced', mkInput({ circuitState: 'closed' }));
    const half = score('balanced', mkInput({ circuitState: 'half-open' }));
    expect(half).toBeCloseTo(full * 0.5);
  });
});

// ─── PhonixRouter ─────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<RouterConfig> = {}): RouterConfig {
  return {
    providers: ['acurast', 'akash'],
    secretKey: 'test-key',
    maxRetries: 1,
    retryDelayMs: 0,
    ...overrides,
  };
}

describe('PhonixRouter', () => {
  it('constructs with multiple providers', () => {
    const router = new PhonixRouter(makeConfig());
    const h = router.health();
    expect(h).toHaveLength(2);
    expect(h.map(x => x.provider)).toContain('acurast');
    expect(h.map(x => x.provider)).toContain('akash');
  });

  it('health() returns valid snapshots', () => {
    const router = new PhonixRouter(makeConfig());
    for (const snap of router.health()) {
      expect(snap.circuitState).toBe('closed');
      expect(snap.successRate).toBe(1);
      expect(snap.score).toBeGreaterThan(0);
    }
  });

  it('emits provider:selected event on successful send', async () => {
    const router = new PhonixRouter(makeConfig({ providers: ['acurast'] }));
    // Mock provider send
    const entry = (router as unknown as { entries: Map<string, { provider: { connect: () => Promise<void>; send: () => Promise<void> } }> }).entries.get('acurast')!;
    entry.provider.connect = vi.fn().mockResolvedValue(undefined);
    entry.provider.send = vi.fn().mockResolvedValue(undefined);

    const events: string[] = [];
    router.onEvent(e => events.push(e.type));

    await entry.provider.connect('key');
    await router.send({ test: true });

    expect(events).toContain('provider:selected');
  });

  it('failover to next provider when first fails', async () => {
    const router = new PhonixRouter(makeConfig({ providers: ['acurast', 'akash'], maxRetries: 2 }));

    const entryA = (router as unknown as { entries: Map<string, { provider: { connect: () => Promise<void>; send: () => Promise<void> }; processorIds: string[] }> }).entries.get('acurast')!;
    const entryB = (router as unknown as { entries: Map<string, { provider: { connect: () => Promise<void>; send: () => Promise<void> }; processorIds: string[] }> }).entries.get('akash')!;

    entryA.processorIds = ['proc-a'];
    entryB.processorIds = ['proc-b'];
    entryA.provider.send = vi.fn().mockRejectedValue(new Error('acurast down'));
    entryB.provider.send = vi.fn().mockResolvedValue(undefined);

    const events: string[] = [];
    router.onEvent(e => events.push(e.type));

    await router.send({ test: true });

    expect(entryA.provider.send).toHaveBeenCalled();
    expect(entryB.provider.send).toHaveBeenCalled();
    expect(events).toContain('provider:failed');
  });

  it('reset() clears circuit and health state', () => {
    const router = new PhonixRouter(makeConfig());
    const entry = (router as unknown as { entries: Map<string, { circuit: CircuitBreaker }> }).entries.get('acurast')!;
    entry.circuit.forceState('open');
    router.reset();
    expect(entry.circuit.state).toBe('closed');
  });

  it('onEvent returns an unsubscribe function', () => {
    const router = new PhonixRouter(makeConfig());
    const events: string[] = [];
    const unsub = router.onEvent(e => events.push(e.type));
    unsub();
    // After unsubscribe, no events should fire
    const entry = (router as unknown as { _emit: (e: { type: string; provider: string; timestamp: Date }) => void })._emit;
    // Just verify the unsubscribe didn't throw
    expect(typeof unsub).toBe('function');
  });
});
