import { ESLint } from "eslint";

/**
 * Strict in-memory ESLint instance (no config files)
 */
const eslint = new ESLint({
  useEslintrc: false,

  overrideConfig: {
    env: {
      browser: true,
      es2021: true,
      node: true,
    },

    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },

    rules: {
      "no-console": "error",
      "no-unused-vars": "warn",
      "no-debugger": "error",
      semi: "error",
      "no-undef": "error",
    },
  },
});

/**
 * Read full stdin from Go process
 */
async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Convert ESLint result → your IDE format
 */
function formatResults(results) {
  const out = [];

  for (const file of results) {
    for (const msg of file.messages) {
      out.push({
        line: msg.line,
        column: msg.column,
        endLine: msg.endLine,
        endColumn: msg.endColumn,
        message: msg.message,
        severity: msg.severity === 2 ? "error" : "warning",
      });
    }
  }

  return out;
}

/**
 * Main runner (CLI worker)
 */
async function run() {
  try {
    const code = await readStdin();

    console.log("===== LINT START =====");

    if (!code || !code.trim()) {
      console.log("RAW OUTPUT:");
      console.log("[]");
      console.log("===== LINT END =====");
      return;
    }

    const results = await eslint.lintText(code, {
      filePath: "virtual.js", // IMPORTANT for rule activation
    });

    const formatted = formatResults(results);

    console.log("RAW OUTPUT:");
    console.log(JSON.stringify(formatted));

    console.log("===== LINT END =====");
  } catch (err) {
    console.error("ESLint crash:", err);
    console.log("[]");
  }
}

run();
