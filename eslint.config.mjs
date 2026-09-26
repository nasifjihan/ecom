// @ts-check
/**
 * ESLint 9 flat config (replaces the legacy .eslintrc.cjs, which ESLint 9 no longer reads).
 * Same rule set as before: eslint:recommended + typescript-eslint type-checked + prettier.
 */
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default [
  {
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/.next/",
      "**/build/",
      "**/coverage/",
      "**/prisma/generated/",
      "apps/api/prisma/migrations/",
      "**/playwright-report/",
      "**/*.md",
    ],
  },
  js.configs.recommended,
  ...tsPlugin.configs["flat/recommended-type-checked"],
  ...tsPlugin.configs["flat/stylistic-type-checked"],
  prettierRecommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    rules: {
      // We prefer Prettier to OWN these:
      "prettier/prettier": "warn",
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Avoid accidental `any`
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
    },
  },
];
