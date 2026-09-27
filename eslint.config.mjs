import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "out/**",
      "coverage/**",
      "vendor/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "lib/api/schema.d.ts",
    ],
  },
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: "Don't parse money with floats; use lib/amount.ts.",
        },
      ],
    },
  },
];

export default config;
