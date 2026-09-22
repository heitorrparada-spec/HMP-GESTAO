import nextPlugin from "@next/eslint-plugin-next";

// `eslint-config-next` (core-web-vitals/typescript) puxa typescript-eslint,
// que ainda não suporta TypeScript 7 (usado neste projeto) — ver
// docs/hmp-os/validation-v0.1.md. Por isso usamos o plugin do Next.js
// diretamente (sem typescript-eslint) em vez de `eslint-config-next`.
// A checagem de tipos real já roda em `npm run build` (tsc nativo do Next).
const eslintConfig = [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/generated/**",
    ],
  },
];

export default eslintConfig;
