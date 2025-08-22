module.exports = {
  root: true,
  env: { node: true, es2021: true },
  // Apply basic parser options globally but only load a TS "project" for
  // TypeScript files via an override — this prevents the parser from
  // attempting to validate non-TS files (like this config) against the
  // tsconfig.json.
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier', 'import'],
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  rules: {
    'prettier/prettier': 'error',
    // allow dev dependencies in scripts folder (e.g. tools)
    'import/no-extraneous-dependencies': ['error', { devDependencies: ['scripts/**', 'test/**'] }],
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        // put TypeScript-specific rule overrides here if needed
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', 'pnpm-lock.yaml'],
};
