export function detectLang(name = "") {
  if (name.endsWith(".js")) return "js";
  if (name.endsWith(".go")) return "go";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".sql")) return "sql";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".py")) return "py";
  if (name.endsWith(".rs")) return "rs";
  if (name.endsWith(".md")) return "md";

  if (name === "README.txt") return "md";
  if (name === "README") return "md";

  return "txt";
}
