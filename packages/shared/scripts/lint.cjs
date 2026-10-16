const { spawnSync } = require("node:child_process");

process.env.ESLINT_USE_FLAT_CONFIG = "false";

const result = spawnSync("eslint", [".", "--ext", ".ts,.tsx"], {
  shell: true,
  stdio: "inherit",
});

if (result.error) {
  console.error("Failed to start ESLint:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
