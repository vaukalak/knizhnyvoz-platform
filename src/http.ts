import { createServer as createHttpServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import { loadLocalEnv } from "./env.js";
import { createServer } from "./server.js";

loadLocalEnv();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const localOnly = host === "127.0.0.1" || host === "localhost" || host === "::1";

const handler = createMcpHandler(() => createServer(), { responseMode: "json" });
const nodeHandler = toNodeHandler(handler);
const validateHost = localOnly ? localhostHostValidation() : () => true;
const validateOrigin = localOnly ? localhostOriginValidation() : () => true;

const httpServer = createHttpServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }
  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
    return;
  }
  if (!validateHost(req, res) || !validateOrigin(req, res)) {
    return;
  }
  void nodeHandler(req, res);
});

httpServer.listen(port, host, () => {
  console.error(`Кніжны воз MCP: http://${host}:${port}/mcp`);
});

process.on("SIGINT", async () => {
  await handler.close();
  httpServer.close();
});
