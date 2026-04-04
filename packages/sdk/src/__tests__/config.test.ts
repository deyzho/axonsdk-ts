import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, generateConfig, generateEnv } from '../config.js';
import { ConfigValidationError } from '../types.js';

describe('generateConfig', () => {
  it('should produce valid JSON', () => {
    const output = generateConfig({ projectName: 'my-app' });
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should include the project name', () => {
    const output = generateConfig({ projectName: 'edge-oracle' });
    const parsed = JSON.parse(output);
    expect(parsed.projectName).toBe('edge-oracle');
  });

  it('should default to acurast provider', () => {
    const output = generateConfig({ projectName: 'test' });
    const parsed = JSON.parse(output);
    expect(parsed.provider).toBe('acurast');
  });

  it('should default to nodejs runtime', () => {
    const output = generateConfig({ projectName: 'test' });
    const parsed = JSON.parse(output);
    expect(parsed.runtime).toBe('nodejs');
  });

  it('should use specified provider', () => {
    const output = generateConfig({ projectName: 'test', provider: 'fluence' });
    const parsed = JSON.parse(output);
    expect(parsed.provider).toBe('fluence');
  });

  it('should include a valid schedule', () => {
    const output = generateConfig({ projectName: 'test', scheduleType: 'interval', durationMs: 3600000 });
    const parsed = JSON.parse(output);
    expect(parsed.schedule.type).toBe('interval');
    expect(parsed.schedule.durationMs).toBe(3600000);
  });
});

describe('generateEnv', () => {
  it('should produce a string with PHONIX_SECRET_KEY', () => {
    const env = generateEnv();
    expect(env).toContain('PHONIX_SECRET_KEY');
  });

  it('should produce a string with ACURAST_MNEMONIC', () => {
    const env = generateEnv();
    expect(env).toContain('ACURAST_MNEMONIC');
  });

  it('should produce a string with ACURAST_IPFS_URL', () => {
    const env = generateEnv();
    expect(env).toContain('ACURAST_IPFS_URL');
  });

  it('should include comments explaining each variable', () => {
    const env = generateEnv();
    expect(env).toContain('#');
  });
});

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'phonix-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should load a valid phonix.json', async () => {
    const config = {
      projectName: 'test-project',
      provider: 'acurast',
      runtime: 'nodejs',
      entryFile: 'src/index.ts',
      schedule: { type: 'on-demand', durationMs: 86400000 },
      replicas: 3,
    };
    await writeFile(join(tmpDir, 'phonix.json'), JSON.stringify(config));

    const loaded = await loadConfig(tmpDir);
    expect(loaded.projectName).toBe('test-project');
    expect(loaded.provider).toBe('acurast');
    expect(loaded.runtime).toBe('nodejs');
    expect(loaded.schedule.type).toBe('on-demand');
    expect(loaded.replicas).toBe(3);
  });

  it('should throw if phonix.json does not exist', async () => {
    await expect(loadConfig(tmpDir)).rejects.toThrow('phonix.json not found');
  });

  it('should throw ConfigValidationError for invalid provider', async () => {
    const config = {
      projectName: 'test',
      provider: 'invalid-provider',
      runtime: 'nodejs',
      entryFile: 'src/index.ts',
      schedule: { type: 'on-demand' },
    };
    await writeFile(join(tmpDir, 'phonix.json'), JSON.stringify(config));

    await expect(loadConfig(tmpDir)).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it('should throw ConfigValidationError for invalid runtime', async () => {
    const config = {
      projectName: 'test',
      provider: 'acurast',
      runtime: 'ruby', // invalid
      entryFile: 'src/index.ts',
      schedule: { type: 'on-demand' },
    };
    await writeFile(join(tmpDir, 'phonix.json'), JSON.stringify(config));

    await expect(loadConfig(tmpDir)).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it('should throw ConfigValidationError for missing projectName', async () => {
    const config = {
      provider: 'acurast',
      runtime: 'nodejs',
      entryFile: 'src/index.ts',
      schedule: { type: 'on-demand' },
    };
    await writeFile(join(tmpDir, 'phonix.json'), JSON.stringify(config));

    await expect(loadConfig(tmpDir)).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it('should throw on invalid JSON', async () => {
    await writeFile(join(tmpDir, 'phonix.json'), '{ invalid json }');
    await expect(loadConfig(tmpDir)).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it('should optionally load replicas, maxCostPerExecution, environment, destinations', async () => {
    const config = {
      projectName: 'test',
      provider: 'acurast',
      runtime: 'nodejs',
      entryFile: 'src/index.ts',
      schedule: { type: 'on-demand' },
      replicas: 5,
      maxCostPerExecution: 500000,
      environment: { API_KEY: 'secret' },
      destinations: ['0xabc'],
    };
    await writeFile(join(tmpDir, 'phonix.json'), JSON.stringify(config));

    const loaded = await loadConfig(tmpDir);
    expect(loaded.replicas).toBe(5);
    expect(loaded.maxCostPerExecution).toBe(500000);
    expect(loaded.environment).toEqual({ API_KEY: 'secret' });
    expect(loaded.destinations).toEqual(['0xabc']);
  });
});
