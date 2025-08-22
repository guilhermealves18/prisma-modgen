// scripts/generate-module.ts
import { getDMMF } from '@prisma/internals';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

import { writeFile } from './lib/helpers';
import { buildFiles } from './lib/templates';

function getFlagValue(flag: string): string | undefined {
  const argv = process.argv.slice(2);
  for (const a of argv) {
    if (a === flag) {
      const idx = process.argv.indexOf(a);
      return process.argv[idx + 1];
    }
    if (a.startsWith(flag + '=')) {
      return a.split('=')[1];
    }
  }
  return undefined;
}

function nonFlagArgs(): string[] {
  return process.argv.slice(2).filter((a) => !a.startsWith('--') && !a.startsWith('-'));
}

function prompt(question: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function main() {
  // flags
  const schemaFlag = getFlagValue('--schema') || path.join(process.cwd(), 'prisma', 'schema.prisma');
  const modelsFlag = getFlagValue('--models'); // comma separated
  const interactive = process.argv.includes('--interactive') || process.argv.includes('-i');
  const listOnly = process.argv.includes('--list');
  const force = process.argv.includes('--force') || process.argv.includes('-f');
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d') || process.argv.includes('--preview');

  // positional non-flag args (first can be model name)
  const positional = nonFlagArgs();

  // Load schema
  if (!fs.existsSync(schemaFlag)) throw new Error(`❌ schema.prisma not found at: ${schemaFlag}`);
  const schema = fs.readFileSync(schemaFlag, 'utf-8');
  const dmmf = await getDMMF({ datamodel: schema });

  const availableModels = dmmf.datamodel.models.map((m) => m.name);

  if (listOnly) {
    // eslint-disable-next-line no-console
    console.log('Available models:');
    for (const m of availableModels) console.log(' -', m);
    return;
  }

  let modelsToGenerate: string[] = [];

  if (positional.length > 0) {
    modelsToGenerate = positional;
  } else if (modelsFlag) {
    modelsToGenerate = modelsFlag.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (interactive) {
    // show models and ask user to choose (comma separated indices)
    // eslint-disable-next-line no-console
    console.log('Detected models:');
    availableModels.forEach((m, i) => console.log(`${i + 1}) ${m}`));
    const answer = await prompt('Choose models to generate (comma separated numbers or names), or `all`: ');
    if (!answer) throw new Error('No selection provided');
    if (answer.trim().toLowerCase() === 'all') {
      modelsToGenerate = availableModels.slice();
    } else {
      const parts = answer.split(',').map((s) => s.trim()).filter(Boolean);
      const picks: string[] = [];
      for (const p of parts) {
        if (/^\d+$/.test(p)) {
          const idx = Number(p) - 1;
          if (availableModels[idx]) picks.push(availableModels[idx]);
        } else if (availableModels.includes(p)) {
          picks.push(p);
        } else {
          // try case-insensitive match
          const found = availableModels.find((m) => m.toLowerCase() === p.toLowerCase());
          if (found) picks.push(found);
        }
      }
      modelsToGenerate = Array.from(new Set(picks));
    }
  } else {
    throw new Error('❌ Informe o nome do model, use --models, ou passe --interactive para escolher. Ex: pnpm tsx scripts/generate-module.ts Account');
  }

  if (modelsToGenerate.length === 0) throw new Error('❌ Nenhum model selecionado para geração');

  for (const modelName of modelsToGenerate) {
    const model = dmmf.datamodel.models.find((m) => m.name === modelName);
    if (!model) {
      // eslint-disable-next-line no-console
      console.warn(`⚠️ Model '${modelName}' não encontrado no schema.prisma. Pulando.`);
      continue;
    }

    const fields = model.fields.map((f) => ({
      name: f.name,
      type: f.type,
      isRequired: (f as any).isRequired ?? !(f as any).isNullable,
      kind: f.kind, // 'scalar' | 'object' | 'enum'
      isList: !!(f as any).isList,
    }));

    const files = buildFiles(modelName, fields as any);

    if (dryRun) {
      // show what would be created
      // eslint-disable-next-line no-console
      console.log(`DRY RUN - files that would be created for model ${modelName}:`);
      for (const file of Object.keys(files)) console.log(' -', file);
      continue;
    }

    for (const [file, content] of Object.entries(files)) {
      writeFile(file, content, force);
    }
  }
}

main();
