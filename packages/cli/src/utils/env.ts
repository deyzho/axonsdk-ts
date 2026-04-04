/**
 * Minimal .env loader — reads KEY=VALUE pairs from a .env file and sets
 * them on process.env. Does not override already-set variables.
 *
 * We avoid adding `dotenv` as a dependency to keep the CLI lightweight.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load environment variables from `.env` in `cwd`.
 * Silently ignores missing files.
 */
export function config(cwd: string = process.cwd()): void {
  const envPath = join(cwd, '.env');
  if (!existsSync(envPath)) return;

  let content: string;
  try {
    content = readFileSync(envPath, 'utf8');
  } catch {
    return;
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    if (!key) continue;

    // Strip surrounding single or double quotes (e.g. MNEMONIC="word1 word2")
    if (value.length >= 2) {
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
    }

    // Do not override variables that are already set in the environment
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
