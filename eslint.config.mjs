import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // ═══════════════════════════════════════════
      // no-undef — TypeScript handles this
      // ═══════════════════════════════════════════
      "no-undef": "off",

      // ═══════════════════════════════════════════
      // TypeScript — rules enforced as WARNINGS
      // (visible in CI, don't break build yet)
      // ═══════════════════════════════════════════
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",

      // ═══════════════════════════════════════════
      // React Hooks — critical rules ON
      // ═══════════════════════════════════════════
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Experimental hooks rules — still off
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/globals": "off",
      "react-hooks/unsupported-syntax": "off",

      // ═══════════════════════════════════════════
      // React — noise reduction for Arabic content
      // ═══════════════════════════════════════════
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",

      // ═══════════════════════════════════════════
      // Next.js
      // ═══════════════════════════════════════════
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-sync-scripts": "error",

      // ═══════════════════════════════════════════
      // Cleanliness
      // ═══════════════════════════════════════════
      "eslint-comments/no-unused-disable": "off",
    },

    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "app/generated/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;