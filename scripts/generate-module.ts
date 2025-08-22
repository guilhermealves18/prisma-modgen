// scripts/generate-module.ts
import { getDMMF } from '@prisma/internals';
import fs from 'fs';
import path from 'path';

import { writeFile } from './lib/helpers';
import { buildFiles } from './lib/templates';

async function main() {
  // support calling the CLI with a leading `--` (e.g. `pnpm exec prisma-api-generator -- Webhook`)
  let modelName = process.argv[2];
  if (modelName === '--') modelName = process.argv[3];
  if (!modelName) {
    // Throw instead of using process.exit to make flow easier for typechecker
    throw new Error('❌ Informe o nome do model. Ex: pnpm tsx scripts/generate-module.ts Account');
  }

  // Lê schema.prisma
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const dmmf = await getDMMF({ datamodel: schema });

  const model = dmmf.datamodel.models.find((m) => m.name === modelName);
  if (!model) {
    throw new Error(`❌ Model '${modelName}' não encontrado no schema.prisma`);
  }

  const fields = model.fields.map((f) => ({
    name: f.name,
    type: f.type,
    isRequired: (f as any).isRequired ?? !(f as any).isNullable,
    kind: f.kind, // 'scalar' | 'object' | 'enum'
    isList: !!(f as any).isList,
  }));

  const force = process.argv.includes('--force') || process.argv.includes('-f');
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

  const files = buildFiles(modelName, fields as any);

  if (dryRun) {
    // show what would be created
    // eslint-disable-next-line no-console
    console.log('DRY RUN - files that would be created:');
    for (const file of Object.keys(files)) console.log(' -', file);
    return;
  }

  for (const [file, content] of Object.entries(files)) {
    writeFile(file, content, force);
  }
}

main();
