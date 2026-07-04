import * as monaco from "monaco-editor";
import prettier from "prettier/standalone";

import tsPlugin from "prettier/plugins/typescript";
import estreePlugin from "prettier/plugins/estree";

import type { MonacoLanguage } from "../types";

export const typescript: MonacoLanguage = {
  id: "typescript",

  async formatter(model) {
    console.log("Formatting TypeScript"); // or JavaScript
    const formatted = await prettier.format(model.getValue(), {
      parser: "typescript",
      plugins: [tsPlugin, estreePlugin],
    });

    return [
      {
        range: model.getFullModelRange(),
        text: formatted,
      },
    ];
  },
};