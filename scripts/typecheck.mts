import { execSync } from "child_process";

console.log("🔍 Running type check...");

// React Routerの型生成
console.log("📝 Generating React Router types...");
execSync("npx react-router typegen", { cwd: "apps/web", stdio: "inherit" });

// Project Referencesで全パッケージをチェック
console.log("📝 Running tsc -b...");
execSync("tsc -b", { stdio: "inherit" });

// 各パッケージの開発用tsconfigでもチェック
const packagesToCheck = ["utils", "domains", "repositories", "ui-core"];

for (const pkg of packagesToCheck) {
  console.log(`📝 Checking packages/${pkg}...`);
  execSync(`tsc --project packages/${pkg}/tsconfig.json --noEmit`, {
    stdio: "inherit",
  });
}

console.log("✅ Type check passed!");
