import { execSync } from "child_process";

console.log("🔨 Building all packages...");

// パッケージをビルド（postinstallと同じ順序）
execSync("npm run build -w @my-project/utils", { stdio: "inherit" });
execSync("npm run build -w @my-project/domains", { stdio: "inherit" });
execSync("npm run build -w @my-project/ui-core", { stdio: "inherit" });
execSync("npm run build -w @my-project/repositories", { stdio: "inherit" });

console.log("🔨 Building web app...");
execSync("npm run build -w @my-project/web", { stdio: "inherit" });

console.log("✅ Build completed!");
