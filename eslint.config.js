// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";

export default tseslint.config(
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/prefer-inject": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.html"],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  }
);
