import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';

const source = new URL('../openapi.json', import.meta.url);
const destination = new URL('../api.generated.ts', import.meta.url);
const ast = await openapiTS(source);
const output = '// Generated from the implemented FastAPI OpenAPI contract. Do not edit.\n' + astToString(ast);
if (process.argv.includes('--check')) {
  const current = await readFile(destination, 'utf8').catch(() => '');
  if (current !== output) {
    process.stderr.write('Generated TypeScript differs; regenerate and review the API contract.\n');
    process.exitCode = 1;
  }
} else {
  await writeFile(destination, output, 'utf8');
}
