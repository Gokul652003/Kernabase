// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

/**
 * The architectural rules in ARCHITECTURE.md are enforced here rather than by convention.
 * Every `boundaries/element-types` and `no-restricted-*` rule below corresponds to a
 * numbered rule in that document; changing one means changing the other.
 */
/** Concrete infrastructure that only src/db may name directly. */
const ADAPTER_IMPORTS = {
  group: ['@/db/**/postgres-*', '@/db/**/connection-registry.service', '@/db/**/control-plane.pool'],
  message: 'Import the port (src/db/**/*.ports.ts), not the adapter.',
};

export default tseslint.config(
  { ignores: ['dist/**', 'dist-test/**', 'node_modules/**', 'eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: { project: ['./tsconfig.json', './tsconfig.test.json'], tsconfigRootDir: import.meta.dirname },
    },
    plugins: { boundaries },
    settings: {
      // Without a resolver that understands the `@/*` alias, boundaries silently treats
      // every internal import as external and enforces nothing.
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/include': ['src/**/*.ts'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/*.ts', mode: 'full' },
        { type: 'config', pattern: 'src/config/**', mode: 'full' },
        { type: 'common', pattern: 'src/common/**', mode: 'full' },
        { type: 'db', pattern: 'src/db/**', mode: 'full' },
        { type: 'feature', pattern: 'src/*/**', mode: 'full', capture: ['feature'] },
      ],
    },
    rules: {
      // Rule 3: dependencies point inward. Infrastructure may not reach up into features,
      // and config/common may not reach down into anything.
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'app', allow: ['app', 'config', 'common', 'db', 'feature'] },
          { from: 'config', allow: ['config'] },
          { from: 'common', allow: ['common', 'config'] },
          { from: 'db', allow: ['db', 'common', 'config'] },
          { from: 'feature', allow: ['feature', 'db', 'common', 'config'] },
        ],
      }],
      'boundaries/no-unknown-files': 'off',

      // Rule 2: process.env is read in exactly one place.
      'no-restricted-properties': ['error', {
        object: 'process',
        property: 'env',
        message: 'Read configuration through AppConfig (src/config) instead of process.env.',
      }],

      // Rule 3: features talk to ports; concrete infrastructure stays inside src/db.
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'pg',
          message: 'Only src/db may depend on the PostgreSQL driver. Depend on a port instead.',
        }],
        patterns: [ADAPTER_IMPORTS],
      }],

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // NB: `consistent-type-imports` is deliberately NOT enabled. It is unsafe with
      // `emitDecoratorMetadata`, which Nest relies on: rewriting a DTO or provider import
      // to `import type` erases the runtime metadata and breaks injection silently.
      'no-console': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },

  // Rule 1: business and persistence logic raises transport-neutral ApplicationErrors.
  // HTTP exceptions belong to the HTTP adapter (controllers, filters) only.
  {
    files: ['src/**/*.service.ts', 'src/**/*.guard.ts', 'src/**/*.builder.ts', 'src/**/*.repository.ts', 'src/**/*.adapter.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@nestjs/common',
            importNames: [
              'HttpException', 'BadRequestException', 'NotFoundException', 'ForbiddenException',
              'UnauthorizedException', 'ConflictException', 'PayloadTooLargeException',
              'InternalServerErrorException', 'ServiceUnavailableException',
            ],
            message: 'Throw ApplicationError (src/common/errors) — services are driven by non-HTTP adapters too.',
          },
          { name: 'pg', message: 'Only src/db may depend on the PostgreSQL driver.' },
        ],
        patterns: [ADAPTER_IMPORTS],
      }],
    },
  },
  { files: ['src/db/**/*.ts'], rules: { 'no-restricted-imports': 'off' } },
  { files: ['src/config/**/*.ts'], rules: { 'no-restricted-properties': 'off' } },
  { files: ['src/**/*.spec.ts', 'test/**/*.ts'], rules: {
    'no-restricted-properties': 'off',
    'no-restricted-imports': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'boundaries/element-types': 'off',
  } },
);
