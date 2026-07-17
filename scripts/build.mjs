import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
const result = spawnSync('tsc', ['-p', 'tsconfig.build.json'], { stdio: 'inherit', shell: true });
if (result.status !== 0) process.exit(result.status ?? 1);
await cp('public', 'dist', { recursive: true });
const baseStyles = await readFile('src/styles.css', 'utf8');
const ultraStyles = await readFile('src/ultra.css', 'utf8');
const lifeOsStyles = await readFile('src/life-os.css', 'utf8');
await writeFile('dist/assets/styles.css', `${baseStyles}\n${ultraStyles}\n${lifeOsStyles}\n`);
const html = await readFile('index.html', 'utf8');
await writeFile('dist/index.html', html);
console.log('Build Quotidien V7 Life OS terminé dans dist/.');
