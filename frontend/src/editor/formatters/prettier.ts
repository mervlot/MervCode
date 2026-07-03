import prettier from "prettier/standalone";
import parserBabel from "prettier/plugins/babel";
import parserEstree from "prettier/plugins/estree";
import parserTypescript from "prettier/plugins/typescript";

export async function formatJS(
  code: string,
  lang: "js" | "ts",
): Promise<string> {
  try {
    const parser = lang === "ts" ? "typescript" : "babel";

    return await prettier.format(code, {
      parser,
      plugins: [parserBabel, parserEstree, parserTypescript],
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: "es5",
    });
  } catch (err) {
    console.error("Prettier error:", err);
    return code;
  }
}
