import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        global: 'readonly',
        File: 'readonly',
        createImageBitmap: 'readonly',
        OffscreenCanvas: 'readonly',
        importScripts: 'readonly',
        ort: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-undef': 'off',
      'no-empty': 'off',
      'preserve-caught-error': 'off',
    },
  },
];
