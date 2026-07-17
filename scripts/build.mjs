import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
const result = spawnSync('tsc', ['-p', 'tsconfig.build.json'], { stdio: 'inherit', shell: true });
if (result.status !== 0) process.exit(result.status ?? 1);
await cp('public', 'dist', { recursive: true });
await cp('src/styles.css', 'dist/assets/styles.css');
const html = await readFile('index.html', 'utf8');
await writeFile('dist/index.html', html);
console.log('Build V6 terminé dans dist/.');
