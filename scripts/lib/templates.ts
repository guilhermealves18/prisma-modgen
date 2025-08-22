import fs from 'fs';
import path from 'path';
import pluralize from 'pluralize';
import { mapFieldType } from './helpers';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Handlebars: any = require('handlebars');

type FieldShape = { name: string; type: string; isRequired: boolean; kind?: string; isList?: boolean };

function loadTemplate(name: string) {
  const tplPath = path.resolve(__dirname, '..', 'templates', `${name}.hbs`);
  const raw = fs.readFileSync(tplPath, 'utf8');
  return Handlebars.compile(raw);
}

// register helpers
if (!Handlebars.helpers.eq) {
  Handlebars.registerHelper('eq', function (a: any, b: any) {
    return a === b;
  });
}

// helper to check presence inside array
if (!Handlebars.helpers.inArray) {
  Handlebars.registerHelper('inArray', function (arr: any[], val: any) {
    if (!Array.isArray(arr)) return false;
    return arr.indexOf(val) !== -1;
  });
}

if (!Handlebars.helpers.not) {
  Handlebars.registerHelper('not', function (val: any) {
    return !val;
  });
}

if (!Handlebars.helpers.toKebab) {
  Handlebars.registerHelper('toKebab', function (str: string) {
    return String(str)
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .toLowerCase();
  });
}

const tplEntity = loadTemplate('_entity');
const tplMapper = loadTemplate('_mapper');
const tplRepository = loadTemplate('_repository');
const tplUsecaseCreate = loadTemplate('_usecase_create');
const tplUsecaseDelete = loadTemplate('_usecase_delete');
const tplUsecaseFind = loadTemplate('_usecase_find_by_id');
const tplUsecaseList = loadTemplate('_usecase_list');
const tplUsecaseUpdate = loadTemplate('_usecase_update');
const tplPrismaMapper = loadTemplate('_prisma_mapper');
const tplPrismaRepository = loadTemplate('_prisma_repository');
const tplController = loadTemplate('_controller');
const tplDtoCreate = loadTemplate('_dto_create');
const tplDtoUpdate = loadTemplate('_dto_update');

export function buildFiles(
  modelName: string,
  fields: ReadonlyArray<FieldShape>,
): Record<string, string> {
  const moduleName = pluralize(modelName.toLowerCase());
  const singularName = pluralize.singular(modelName.toLowerCase());
  const baseDir = `src/modules/${moduleName}`;

  const fieldCtx = fields.map((f) => {
    const mapped = mapFieldType(f.type, f.kind);
    const typeValidators: string[] = [];
    // determine type-specific validators
    if (f.name === 'id') {
      typeValidators.push('IsUUID');
    } else {
      if (mapped.importPrisma && f.kind === 'enum') {
        typeValidators.push('IsEnum');
      } else {
        if (!mapped.importPrisma && mapped.tsType === 'string') typeValidators.push('IsString');
        if (!mapped.importPrisma && mapped.tsType === 'number') typeValidators.push('IsNumber');
        if (!mapped.importPrisma && mapped.tsType === 'boolean') typeValidators.push('IsBoolean');
        if (!mapped.importPrisma && mapped.tsType === 'Date') typeValidators.push('IsDate');
        if (!mapped.importPrisma && typeof mapped.tsType === 'string' && mapped.tsType.startsWith('Record')) typeValidators.push('IsObject');
      }
    }

    // override optionality rules per user request
    let isRequired = f.isRequired;
  if (['createdAt', 'updatedAt', 'deletedAt', 'id'].includes(f.name)) {
      // id and specified fields should be treated as optional on generated entities
      isRequired = false;
    }

    const validators: string[] = [];
    if (f.name === 'id') {
      // id should always be optional on created entities
      validators.push(...typeValidators);
      validators.push('IsOptional');
    } else {
      if (!isRequired) validators.push('IsOptional');
      validators.push(...typeValidators);
    }

    return {
      name: f.name,
      tsType: mapped.tsType,
      importPrisma: mapped.importPrisma ?? false,
      isRequired,
      isId: f.name === 'id',
      excluded: f.name === 'id' || f.name === 'createdAt' || f.name === 'updatedAt' || f.name === 'deletedAt',
      validators,
      kind: f.kind,
    };
  });

  // For entity files we must exclude relational/object fields
  const entityFields = fieldCtx.filter((f) => f.kind !== 'object');
  // DTOs should exclude only relational/object fields; include id and timestamps in DTOs
  const dtoFields = fieldCtx
    .filter((f) => f.kind !== 'object')
    .map((f) => {
      // customId should have @IsOptional() decorator in DTOs but remain a required property type
      if (f.name === 'customId') {
        const validators = Array.from(new Set([...(f.validators || []), 'IsOptional']));
        return { ...f, validators };
      }
      return f;
    });

    const dtoFieldNames = dtoFields.map((f) => f.name);

    const prismaImports = new Set<string>();
  const validatorImports = new Set<string>();
  // collect imports needed for entities and dtos
  const importSourceFields = [...entityFields, ...dtoFields];
  importSourceFields.forEach((f) => {
    if (f.importPrisma && typeof f.tsType === 'string') prismaImports.add(f.tsType);
    f.validators.forEach((v: string) => validatorImports.add(v));
  });

  function withImports(content: string) {
    let header = '';
    if (validatorImports.size > 0) {
      header += `import { ${Array.from(validatorImports).join(', ')} } from 'class-validator';\n`;
    }
    if (prismaImports.size > 0) {
      header += `import { ${Array.from(prismaImports).join(', ')} } from 'generated/prisma';\n`;
    }
    if (header.length === 0) return content;
    return `${header}\n${content}`;
  }

  // determine searchable fields (strings) based on DTO fields
  const searchableFields = dtoFields.filter((f) => f.tsType === 'string' && !f.excluded).map((f) => f.name);
  const hasSearchableFields = searchableFields.length > 0;

  const tplModule = loadTemplate('_module');

  const files: Record<string, string> = {
    [`${baseDir}/${moduleName}.module.ts`]: tplModule({ ModelName: modelName, moduleName, singularName }),

  [`${baseDir}/core/entities/${singularName}.entity.ts`]: withImports(tplEntity({ ModelName: modelName, entityFields })),
  [`${baseDir}/core/mappers/${singularName}.mapper.ts`]: tplMapper({ ModelName: modelName, fields: fieldCtx }),
  [`${baseDir}/core/repositories/${singularName}.repository.ts`]: tplRepository({ ModelName: modelName, fields: fieldCtx, singularName, moduleName }),

  [`${baseDir}/core/use-cases/create-${singularName}.use-case.ts`]: tplUsecaseCreate({
    ModelName: modelName,
    dtoFields,
    dtoFieldNames,
    singularName,
    repoPropName: `${singularName}Repository`,
    entityVarName: `${singularName}Entity`,
    hasGoogleId: dtoFieldNames.includes('googleId'),
    hasEmail: dtoFieldNames.includes('email'),
    hasPassword: dtoFieldNames.includes('password'),
  }),
    [`${baseDir}/core/use-cases/delete-${singularName}.use-case.ts`]: tplUsecaseDelete({
      ModelName: modelName,
      singularName,
      repoPropName: `${singularName}Repository`,
      entityVarName: `${singularName}`,
    }),
    [`${baseDir}/core/use-cases/find-${singularName}-by-id.use-case.ts`]: tplUsecaseFind({
      ModelName: modelName,
      singularName,
      repoPropName: `${singularName}Repository`,
      entityVarName: `${singularName}`,
    }),
  [`${baseDir}/core/use-cases/list-${moduleName}.use-case.ts`]: tplUsecaseList({ ModelName: modelName, singularName, pluralName: moduleName }),
    [`${baseDir}/core/use-cases/update-${singularName}.use-case.ts`]: tplUsecaseUpdate({
      ModelName: modelName,
      singularName,
      repoPropName: `${singularName}Repository`,
      entityVarName: `${singularName}Entity`,
      hasEmail: dtoFieldNames.includes('email'),
    }),

  [`${baseDir}/infra/database/prisma/mappers/prisma.${singularName}.mapper.ts`]: tplPrismaMapper({ ModelName: modelName, fields: fieldCtx, singularName: singularName, moduleName }),
  [`${baseDir}/infra/database/prisma/repositories/prisma.${singularName}.repository.ts`]: tplPrismaRepository({ ModelName: modelName, moduleName, singularName, entityFields, dtoFields, searchableFields, hasSearchableFields }),

    [`${baseDir}/infra/http/controllers/${singularName}.controller.ts`]: tplController({
      ModelName: modelName,
      moduleName,
      singularName,
      hasAccountId: dtoFieldNames.includes('accountId'),
    }),
    [`${baseDir}/infra/http/dtos/create-${singularName}.dto.ts`]: withImports(tplDtoCreate({ ModelName: modelName, fields: dtoFields })),
      [`${baseDir}/infra/http/dtos/update-${singularName}.dto.ts`]: withImports(tplDtoUpdate({ ModelName: modelName, fields: dtoFields })),
  };

  return files;
}
