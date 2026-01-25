import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import globals from 'globals';

import nextPlugin from '@next/eslint-plugin-next';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ESLint v9 flat config.
 *
 * Notes:
 * - This project contains vendored/minified JS in `public/assets/**` which should
 *   not be linted.
 * - TypeScript/TSX is used under `src/app/**`.
 */
export default [
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/coverage/**',

      // Vendored/minified browser bundles
      'public/assets/**',
      'public/webfonts/**',

      // Standalone browser script (globals via <script> tags) – skip from repo lint
      'public/app.jsx',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // Node services/routes (JS)
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      // Allow unused catch bindings / placeholder args starting with '_'
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // App/server source (JS/JSX)
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Allow "_"-prefixed unused args/vars in JS files (common for placeholders)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
    settings: {
      next: {
        rootDir: __dirname,
      },
    },
  },

  // App source (TS/TSX)
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // TypeScript already checks names; disable no-undef to avoid false positives
      // for types like React.ReactNode.
      'no-undef': 'off',

      // Prefer TS-aware unused-vars; keep this lightweight.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
    settings: {
      next: {
        rootDir: __dirname,
      },
    },
  },
];
