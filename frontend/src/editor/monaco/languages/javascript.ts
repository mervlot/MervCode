import prettier from "prettier/standalone";
import babelPlugin from "prettier/plugins/babel";
import estreePlugin from "prettier/plugins/estree";

import type { MonacoLanguage } from "../types";

export const javascript: MonacoLanguage = {
  id: "javascript",

  async formatter(model) {
    console.log("Formatting JavaScript");
    const formatted = await prettier.format(model.getValue(), {
      parser: "babel",
      plugins: [babelPlugin, estreePlugin],
    });

    return [
      {
        range: model.getFullModelRange(),
        text: formatted,
      },
    ];
  },
};
