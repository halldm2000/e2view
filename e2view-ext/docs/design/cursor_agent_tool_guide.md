# Making Cursor / VS Code Agent Call Your Tools

This guide shows two complementary patterns for exposing your own functionality so that **Cursor’s agent mode** (or vanilla VS Code’s agent) can call it just like the built‑in tools.

| Where the code lives | How the agent discovers & calls it | Typical use‑case |
|----------------------|------------------------------------|------------------|
| **Inside a VS Code / Cursor extension** | Declare a *language‑model tool* in `package.json`, then register its implementation with `vscode.lm.registerTool(…)`. | Tight IDE integration (show a web‑view, manipulate files, run tasks, etc.). |
| **Outside VS Code in its own process** | Run a small **MCP server** (Model Context Protocol). Agent mode auto‑discovers the server and exposes its *tools*. | Existing service or CLI you don’t want to bundle into an extension. |

---

## 1  Expose a Method *Inside* Your Extension

> Works in VS Code ≥ 1.99. Cursor is currently on 1.96, so test in VS Code Insiders or wait for the next Cursor update.

### 1.1  Describe the Tool (`package.json`)

```jsonc
{
  "contributes": {
    "languageModelTools": [
      {
        "name": "weather_runCorrDiff",            // unique ID
        "displayName": "Run CorrDiff",
        "toolReferenceName": "corrDiff",
        "canBeReferencedInPrompt": true,

        "userDescription": "Downscale a coarse-res field with NVIDIA CorrDiff.",
        "modelDescription": "Runs CorrDiff on a Zarr dataset and returns the path to the result Zarr.",

        "icon": "$(run)",

        "inputSchema": {
          "type": "object",
          "required": ["inputPath"],
          "properties": {
            "inputPath":  { "type": "string", "description": "Absolute path to source Zarr" },
            "outputPath": { "type": "string", "description": "Where to write the result Zarr" },
            "domain":     { "type": "string", "description": "lat,lon bbox e.g. -105,39,-102,41"}
          }
        }
      }
    ]
  }
}
```

### 1.2  Implement & Register the Tool

```ts
// src/tools.ts
import * as vscode from 'vscode';

interface CorrDiffParams {
  inputPath: string;
  outputPath?: string;
  domain?: string;
}

class CorrDiffTool implements vscode.LanguageModelTool<
  CorrDiffParams,
  vscode.LanguageModelTextPart
> {
  readonly name = 'weather_runCorrDiff';

  async prepareInvocation(opts:
    vscode.LanguageModelToolInvocationPrepareOptions<CorrDiffParams>) {

    return {
      title: 'Run CorrDiff',
      message: new vscode.MarkdownString(
        `Run **CorrDiff** on \`${opts.input.inputPath}\`?`
      )
    };
  }

  async invoke(opts:
    vscode.LanguageModelToolInvocationOptions<CorrDiffParams>) {

    const { inputPath, outputPath = '/tmp/corrdiff.zarr', domain } = opts.input;

    const jobId = await runCorrDiff(inputPath, outputPath, domain); // your job runner

    ensureViewerPanel()
      .webview.postMessage({ type: 'job-done', outputPath });

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        `CorrDiff complete (job ${jobId}). Output: ${outputPath}`
      )
    ]);
  }
}

export function activate(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(
    vscode.lm.registerTool('weather_runCorrDiff', new CorrDiffTool())
  );
}
```

Once the extension is loaded, **agent mode automatically lists `#corrDiff`**.  
You can now prompt: “Run #corrDiff on `/data/cfnet.zarr` and plot near‑surface temperature.”

---

## 2  Expose a Web‑App or CLI via an MCP Server

If you already have a backend service, wrap it with a tiny MCP server instead of packaging it as an extension.

1. **Scaffold a server**

```bash
npx @mcpdotdirect/create-mcp-server
cd my-server && npm install
```

2. **Describe & implement a tool**

```ts
registerTool({
  name: 'wx_plotSkewT',
  inputSchema: { /* … */ },
  invoke: async ({ station, time }) => {
    const png = await generateSkewT(station, time);   // your code
    return { contentType: 'image/png', data: png };
  }
});
```

3. **Run** the server (via stdout or HTTP SSE).

4. **Enable in Cursor** → Settings → *MCP* → Add server  
   (`command: ["node", "dist/server.js"]` or `url: http://localhost:4000/sse`).

Agent mode now lists *wx_plotSkewT* alongside your extension tools.

---

## 3  Cursor‑Specific Tips

| Issue | Fix |
|-------|-----|
| Cursor < 1.99 → no `languageModelTools` | Use Cursor Canary or VS Code Insiders until Cursor updates. |
| MCP UI not visible | Press <kbd>Ctrl/Cmd ⇧ J</kbd>, open the **MCP** tab, then “Add Global MCP Server”. |
| Tool isn’t invoked | Ensure every mandatory field is listed in `required` inside `inputSchema`. |
| Show results in a web‑view | Keep your `WebviewPanel` alive and post messages from `invoke()`. |

---

## TL;DR

* **Inside the IDE** → declare `languageModelTools` and register the handler → your extension method becomes an agent tool.  
* **Outside the IDE** → wrap your service with an **MCP server** and turn it on in Cursor.  

Either way, the agent can plan, call, and chain your methods with natural‑language prompts.
