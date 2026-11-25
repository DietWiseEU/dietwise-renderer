import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettierRecommendedConfig from 'eslint-plugin-prettier/recommended';

export default defineConfig(
	{ ignores: ['dist'] },
	{
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2020,
		},
		rules: {
			'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
			'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
			// Catch `${...}` placeholders written in plain quotes, where they are not interpolated
			'no-template-curly-in-string': 'error',
			// Allow unused variables if they are prefixed with _
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
		},
	},
	prettierRecommendedConfig,
	// Override Prettier error → warning
	{
		rules: {
			'prettier/prettier': 'warn',
		},
	},
);
