import concurrently from "concurrently";
import { packages } from "./packages.mts";

await concurrently(
  [
    {
      command: "npm run dev -w @my-project/utils",
      ...packages.utils,
    },
    {
      command: "npm run dev -w @my-project/domains",
      ...packages.domains,
    },
    {
      command: "npm run dev -w @my-project/repositories",
      ...packages.repositories,
    },
    {
      command: "npm run dev -w @my-project/ui-core",
      ...packages.uiCore,
    },
    {
      command: "npm run dev -w @my-project/web",
      ...packages.web,
    },
  ],
  {
    prefix: "[{time}:{name}]",
    timestampFormat: "HH:mm:ss",
  },
);
