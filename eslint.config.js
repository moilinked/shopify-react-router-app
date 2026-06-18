import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'build/',
      'public/build/',
      '.shopify/',
      '.react-router/',
      '**/*.min.js',
      'prisma/migrations/**'
    ]
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        shopify: 'readonly'
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          printWidth: 120,
          tabWidth: 2,
          useTabs: false,
          semi: false,
          singleQuote: true,
          jsxSingleQuote: false,
          trailingComma: 'none',
          bracketSpacing: true,
          bracketSameLine: false,
          arrowParens: 'always',
          endOfLine: 'auto'
        }
      ],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-unused-vars': 'off',
      'no-template-curly-in-string': 'warn',
      'arrow-body-style': ['error', 'as-needed'],
      'prefer-arrow-callback': 'error'
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/default-param-last': 'error',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }]
    }
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y
    },
    settings: {
      react: { version: 'detect' },
      formComponents: ['Form'],
      linkComponents: [
        { name: 'Link', linkAttribute: 'to' },
        { name: 'NavLink', linkAttribute: 'to' }
      ]
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/jsx-indent': ['warn', 2],
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react/no-unknown-property': ['error', { ignore: ['variant'] }],
      'react-refresh/only-export-components': 'off'
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    settings: {
      'import/internal-regex': '^~/',
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
        node: { extensions: ['.ts', '.tsx'] }
      }
    },
    rules: {
      'import/no-duplicates': 'off'
    }
  },
  {
    files: [
      'vite.config.{js,ts}',
      '.graphqlrc.{js,ts}',
      'eslint.config.js',
      'app/db.server.ts',
      'app/shopify.server.ts',
      '**/*.server.{js,ts}'
    ],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  prettier
)
