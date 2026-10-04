import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // ═══════════════════════════════════════════
      // Turn OFF no-undef — TypeScript handles this
      // (Next.js team officially recommends this)
      // ═══════════════════════════════════════════
      "no-undef": "off",

      // ═══════════════════════════════════════════
      // Disable stylistic / opinionated rules
      // ═══════════════════════════════════════════
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/ban-ts-comment": "off",

      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/globals": "off",
      "react-hooks/unsupported-syntax": "off",

      "react/no-unescaped-entities": "off",
      "react/display-name": "off",

      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-sync-scripts": "off",

      // ═══════════════════════════════════════════
      // Reduce noise from unused eslint-disable comments
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