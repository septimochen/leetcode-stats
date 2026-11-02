import { readFileSync, writeFileSync } from 'node:fs';

// cf writes to .cloudflare/types; keep the project's existing tracked type entrypoint.
const generated = readFileSync('.cloudflare/types/index.d.ts', 'utf8');
writeFileSync('worker-configuration.d.ts', generated.replaceAll('../../cloudflare.config', './cloudflare.config'));
