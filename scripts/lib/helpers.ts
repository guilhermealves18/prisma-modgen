import fs from 'fs';
import path from 'path';

export function writeIfNotExists(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    // keep logs minimal
    // eslint-disable-next-line no-console
    console.log(`✅ Created: ${filePath}`);
  }
}

export function writeFile(filePath: string, content: string, force = false) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (force || !fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    // eslint-disable-next-line no-console
    console.log(`${force ? '🔁 Overwritten' : '✅ Created'}: ${filePath}`);
  }
}

export function mapFieldType(type: string, kind?: string): { tsType: string; importPrisma?: boolean } {
  // kind can be 'scalar' | 'object' | 'enum'
  if (kind === 'object') {
    // relation -> prefer using the generated Prisma type for relations
    return { tsType: type, importPrisma: true };
  }

  if (kind === 'enum') {
    // enums are exported by @prisma/client
    return { tsType: type, importPrisma: true };
  }

  switch (type) {
    case 'String':
      return { tsType: 'string' };
    case 'Int':
    case 'Float':
    case 'Decimal':
      return { tsType: 'number' };
    case 'Boolean':
      return { tsType: 'boolean' };
    case 'DateTime':
      return { tsType: 'Date' };
    case 'Json':
      return { tsType: 'Record<string, any>' };
    default:
      return { tsType: 'any' };
  }
}
