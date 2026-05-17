import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const openAiProxyPrefix = "/openai-proxy";

function readRequestBody(request: import("node:http").IncomingMessage) {
  return new Promise<string>((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    request.on("error", rejectBody);
  });
}

function buildOpenAiTargetUrl(requestUrl: string) {
  const parsedUrl = new URL(requestUrl, "http://127.0.0.1");
  const baseUrl = parsedUrl.searchParams.get("baseUrl") || "https://api.openai.com/v1";
  parsedUrl.searchParams.delete("baseUrl");
  const path = parsedUrl.pathname.replace(openAiProxyPrefix, "");
  const normalizedBaseUrl = baseUrl.replace(/\/+$/g, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const query = parsedUrl.searchParams.toString();
  return `${normalizedBaseUrl}${normalizedPath}${query ? `?${query}` : ""}`;
}

function requestOpenAiThroughPowerShell({
  authorization,
  body,
  contentType,
  method,
  url,
}: {
  authorization: string;
  body: string;
  contentType: string;
  method: string;
  url: string;
}) {
  const script = `
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$utf8 = [System.Text.UTF8Encoding]::new($false)
$uri = $env:ARKME_OPENAI_PROXY_URL
$method = $env:ARKME_OPENAI_PROXY_METHOD
$body = $env:ARKME_OPENAI_PROXY_BODY
$auth = $env:ARKME_OPENAI_PROXY_AUTH
$contentType = $env:ARKME_OPENAI_PROXY_CONTENT_TYPE
if ($contentType -and $contentType -notmatch "charset") { $contentType = "$contentType; charset=utf-8" }
$headers = @{}
if ($auth) { $headers["Authorization"] = $auth }
try {
  $params = @{
    Uri = $uri
    Method = $method
    Headers = $headers
    UseBasicParsing = $true
    TimeoutSec = 45
  }
  if ($contentType) { $params.ContentType = $contentType }
  if ($method -ne "GET" -and $body) { $params.Body = $utf8.GetBytes($body) }
  $response = Invoke-WebRequest @params
  $responseBody = ""
  if ($response.RawContentStream) {
    if ($response.RawContentStream.CanSeek) { $response.RawContentStream.Position = 0 }
    $reader = [System.IO.StreamReader]::new($response.RawContentStream, $utf8)
    $responseBody = $reader.ReadToEnd()
  } else {
    $responseBody = [string]$response.Content
  }
  [Console]::Out.Write((ConvertTo-Json @{ status = [int]$response.StatusCode; body = $responseBody } -Compress -Depth 6))
} catch {
  $response = $_.Exception.Response
  if ($response) {
    $reader = [System.IO.StreamReader]::new($response.GetResponseStream(), $utf8)
    $responseBody = $reader.ReadToEnd()
    [Console]::Out.Write((ConvertTo-Json @{ status = [int]$response.StatusCode; body = $responseBody } -Compress -Depth 6))
  } else {
    $errorBody = @{ error = @{ message = $_.Exception.Message; type = "local_proxy_error" } } | ConvertTo-Json -Compress -Depth 6
    [Console]::Out.Write((ConvertTo-Json @{ status = 502; body = $errorBody } -Compress -Depth 6))
  }
}
`;

  return new Promise<{ status: number; body: string }>((resolveProxy, rejectProxy) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        env: {
          ...process.env,
          ARKME_OPENAI_PROXY_AUTH: authorization,
          ARKME_OPENAI_PROXY_BODY: body,
          ARKME_OPENAI_PROXY_CONTENT_TYPE: contentType,
          ARKME_OPENAI_PROXY_METHOD: method,
          ARKME_OPENAI_PROXY_URL: url,
        },
        windowsHide: true,
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectProxy);
    child.on("close", () => {
      try {
        const parsed = JSON.parse(stdout) as { status?: unknown; body?: unknown };
        resolveProxy({
          status: typeof parsed.status === "number" ? parsed.status : 502,
          body: typeof parsed.body === "string" ? parsed.body : "",
        });
      } catch {
        rejectProxy(new Error(stderr || "OpenAI local proxy returned invalid output."));
      }
    });
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "arkme-openai-local-proxy",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (!request.url?.startsWith(openAiProxyPrefix)) {
            next();
            return;
          }

          const targetUrl = buildOpenAiTargetUrl(request.url);
          try {
            const body = await readRequestBody(request);
            const proxyResponse = await requestOpenAiThroughPowerShell({
              authorization: request.headers.authorization ?? "",
              body,
              contentType: request.headers["content-type"] ?? "application/json",
              method: request.method ?? "GET",
              url: targetUrl,
            });

            response.statusCode = proxyResponse.status;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(proxyResponse.body);
          } catch (error) {
            response.statusCode = 502;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(
              JSON.stringify({
                error: {
                  message: error instanceof Error ? error.message : "本地智能识别代理请求失败",
                  type: "local_proxy_error",
                },
              })
            );
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
});
