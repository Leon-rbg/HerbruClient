import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await copyFile('src/renderer/index.html', 'dist/index.html');
await copyFile('src/renderer/styles.css', 'dist/styles.css');