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
    rules: {
      // Disable strict TypeScript rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",

      // Disable prefer-const rule
      "prefer-const": "warn",

      // Make React hooks rules warnings instead of errors
      "react-hooks/exhaustive-deps": "warn",

      // Allow unused variables in development
      "no-unused-vars": "warn",

      // Optional: Disable all TypeScript errors for builds
      // "@typescript-eslint/no-explicit-any": "off",
      // "@typescript-eslint/no-unused-vars": "off",
      // "prefer-const": "off",
      // "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default eslintConfig;
