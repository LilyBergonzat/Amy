import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
            '@typescript-eslint/no-unused-expressions': 'off',
            'no-case-declarations': 'off',
            'no-irregular-whitespace': ['error', { skipTemplates: true }],
            'require-unicode-regexp': ['error', { requireFlag: 'v' }],
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', 'src/generated/**'],
    },
);
