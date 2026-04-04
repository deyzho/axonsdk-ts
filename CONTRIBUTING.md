# Contributing to Phonix

Thank you for your interest in contributing! Phonix is an open-source project and all contributions are welcome.

## Getting started

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/phonix.git
cd phonix

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
cd packages/sdk && npx vitest run
```

## Project structure

```
phonix/
├── packages/
│   ├── cli/       # @phonix/cli — command-line tool (Commander.js)
│   └── sdk/       # @phonix/sdk — core library (TypeScript)
├── templates/
│   ├── inference/ # Confidential LLM inference template
│   └── oracle/    # Data oracle template
└── examples/
    └── nextjs-app/ # Next.js integration example
```

## Making changes

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make your changes** — keep commits focused and descriptive.

3. **Add or update tests** for any new behaviour in `packages/sdk/src/__tests__/`.

4. **Run the test suite** and ensure all tests pass:
   ```bash
   cd packages/sdk && npx vitest run
   ```

5. **Open a pull request** against `main` with a clear title and description of what changed and why.

## Areas where contributions are most welcome

- **Integration tests** against live Acurast testnet
- **New provider support** — Bacalhau, Render Network, Akash
- **Template library** — additional ready-to-deploy templates (scraper, agent, ML pipeline)
- **Documentation** — guides, examples, and API reference improvements
- **Bug reports** — clear reproduction steps are extremely helpful

## Code style

- TypeScript throughout — no untyped `any` unless truly unavoidable
- Keep functions small and single-purpose
- Security-sensitive code (key handling, network requests, JSON parsing) must include comments explaining the threat being mitigated
- No `console.log` in library code — use the provider's `print` global or throw a typed `PhonixError`

## Reporting security issues

Please do **not** open a public GitHub issue for security vulnerabilities. Instead, email the maintainer directly so the issue can be assessed and patched before disclosure.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
