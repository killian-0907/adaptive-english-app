import { spawnSync } from 'node:child_process';
if (process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('Adaptive QA runs only in a local development/test environment.');
const windows = process.platform === 'win32';
const result = spawnSync(windows ? 'cmd.exe' : 'corepack', windows ? ['/d', '/s', '/c', 'corepack pnpm exec vitest run src/qa/trajectories.test.ts'] : ['pnpm', 'exec', 'vitest', 'run', 'src/qa/trajectories.test.ts'], { stdio: 'inherit', env: { ...process.env, ADAPTIVE_QA_REPORT: '1' } });
process.exitCode = result.status ?? 1;
