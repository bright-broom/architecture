import type { Command } from "concurrently";

export interface PackageConfig {
  name: string;
  workspaceName: string;
  prefixColor: Command["prefixColor"];
}

export const packages = {
  web: {
    name: "web",
    workspaceName: "@my-project/web",
    prefixColor: "cyan.bold",
  },
  uiCore: {
    name: "ui-core",
    workspaceName: "@my-project/ui-core",
    prefixColor: "yellow.bold",
  },
  utils: {
    name: "utils",
    workspaceName: "@my-project/utils",
    prefixColor: "blue.bold",
  },
  domains: {
    name: "domains",
    workspaceName: "@my-project/domains",
    prefixColor: "magenta",
  },
  repositories: {
    name: "repositories",
    workspaceName: "@my-project/repositories",
    prefixColor: "green.bold",
  },
} satisfies Record<string, PackageConfig>;
