/**
 * phonix template list — show available built-in templates.
 */

async function getChalk() {
  const mod = await import('chalk');
  return mod.default;
}

interface TemplateInfo {
  name: string;
  displayName: string;
  description: string;
  provider: string;
  runtime: string;
  scheduleType: string;
}

const TEMPLATES: TemplateInfo[] = [
  {
    name: 'inference',
    displayName: 'Confidential Inference',
    description:
      'Run an LLM privately inside a TEE. Receive prompts over WebSocket, return results confidentially.',
    provider: 'acurast',
    runtime: 'nodejs',
    scheduleType: 'on-demand',
  },
  {
    name: 'oracle',
    displayName: 'Data Oracle',
    description:
      'Fetch external data (e.g. price feeds), sign it with the processor keypair, push to a destination.',
    provider: 'acurast',
    runtime: 'nodejs',
    scheduleType: 'interval',
  },
  {
    name: 'blank',
    displayName: 'Blank',
    description:
      'Empty project — provides the _STD_ type declarations and a minimal WebSocket echo server.',
    provider: 'acurast',
    runtime: 'nodejs',
    scheduleType: 'on-demand',
  },
];

export async function runTemplateList(): Promise<void> {
  const chalk = await getChalk();

  console.log();
  console.log(chalk.bold('  Available Phonix templates:\n'));

  const NAME_WIDTH = 10;
  const PROVIDER_WIDTH = 10;
  const RUNTIME_WIDTH = 8;
  const SCHEDULE_WIDTH = 12;

  const header = [
    chalk.bold.gray('  Name'.padEnd(NAME_WIDTH + 2)),
    chalk.bold.gray('Provider'.padEnd(PROVIDER_WIDTH)),
    chalk.bold.gray('Runtime'.padEnd(RUNTIME_WIDTH)),
    chalk.bold.gray('Schedule'.padEnd(SCHEDULE_WIDTH)),
    chalk.bold.gray('Description'),
  ].join('  ');

  console.log(header);
  console.log(chalk.gray('  ' + '─'.repeat(80)));

  for (const t of TEMPLATES) {
    const line = [
      `  ${chalk.cyan(t.name.padEnd(NAME_WIDTH))}`,
      chalk.white(t.provider.padEnd(PROVIDER_WIDTH)),
      chalk.gray(t.runtime.padEnd(RUNTIME_WIDTH)),
      chalk.gray(t.scheduleType.padEnd(SCHEDULE_WIDTH)),
      chalk.gray(t.description.slice(0, 60) + (t.description.length > 60 ? '...' : '')),
    ].join('  ');

    console.log(line);
  }

  console.log();
  console.log(
    chalk.gray('  Use a template:') +
      chalk.white('  phonix init') +
      chalk.gray('  (select at the prompt)')
  );
  console.log(
    chalk.gray('  Run locally:   ') +
      chalk.white('  phonix run-local <template-name>')
  );
  console.log();
}
