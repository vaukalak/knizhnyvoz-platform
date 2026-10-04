import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadLocalEnv } from "./env.js";
import { createServer } from "./server.js";

loadLocalEnv();
void serveStdio(() => createServer());
console.error("Кніжны воз MCP слухае stdio");
