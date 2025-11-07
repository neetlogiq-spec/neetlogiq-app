import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "data/**",
      "*.json",
      "cypress.config.ts",
      "playwright.config.ts"
    ],
  },
  // Strict rules for main application
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn", 
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      "import/no-anonymous-default-export": "warn",
      "@typescript-eslint/no-require-imports": "error"
    }
  },
  // Lenient rules for scripts and utilities
  {
    files: ["scripts/**/*.{js,ts}", "*.ts", "*.js"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-namespace": "off",
      "prefer-const": "off"
    }
  },
  // Test files
  {
    files: ["**/*.test.{js,ts,tsx}", "**/*.spec.{js,ts,tsx}", "cypress/**/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-namespace": "off"
    }
  }
];

export default eslintConfig;
