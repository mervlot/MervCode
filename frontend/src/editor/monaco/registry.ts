import type { MonacoLanguage } from "./types";

import { go } from "./languages/go";
import { java } from "./languages/java";
import { kotlin } from "./languages/kotlin";

import {
  javascript,
  javascriptreact,
  typescript,
  typescriptreact,
} from "./languages/typescriptFamily";

export const registry: Record<string, MonacoLanguage> = {
  go,
  java,
  kotlin,

  typescript,
  typescriptreact,
  javascript,
  javascriptreact,
};
