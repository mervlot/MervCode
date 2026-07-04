// prettier.ts

import type { MonacoLanguage } from "./types";
import prettier from "prettier/standalone";
import parserTS from "prettier/plugins/typescript";

export const prettierFormatter: MonacoLanguage = {
  id: "typescript",

  async formatter(model) {
    const formatted = await prettier.format(model.getValue(), {
      parser: "typescript",
      plugins: [parserTS],
    });

    return [
      {
        range: model.getFullModelRange(),
        text: formatted,
      },
    ];
  },
};
