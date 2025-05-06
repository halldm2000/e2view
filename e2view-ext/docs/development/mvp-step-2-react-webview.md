# MVP Step 2: Integrating a React UI with Vite into the VS Code Webview (with HMR)

This guide follows `mvp-step-1-vscode.md`. In the previous step, we created a basic VS Code extension that opens an empty-ish Webview panel. Now, we'll build a simple User Interface (UI) using **React** and **Vite** and load this UI into our Webview panel, **including support for Vite's Hot Module Replacement (HMR)** for a much faster development experience.

The goal is to replace the static placeholder HTML with a dynamic React application that automatically updates in the Webview during development when you change the UI code.

We assume you have completed the steps in `mvp-step-1-vscode.md` and have the basic extension structure in place within the `e2view-ext` folder. We also assume Node.js and npm are installed.

---

## 🛠️ Prerequisites

*   Completion of `mvp-step-1-vscode.md`.
*   Node.js and npm installed.
*   VS Code open in the main project folder (`e2view-ext`).

---

## 📝 Core Tasks Explained Step-by-Step

### Step 1: ⚛️ Create the React UI Project (using Vite)

(This step remains the same as the previous version of the guide, assuming it was completed correctly)

1.  **Navigate to the Extension Folder:** Open your terminal in VS Code (`Terminal -> New Terminal`). Make sure you are in the root directory of your extension (`e2view-ext`).
    ```bash
    cd /path/to/your/e2view-ext # Ensure you are in the root folder
    ```
2.  **Create the React Project with Vite:** Run the Vite creation command in the root folder. We'll name the UI project folder `ui`.
    ```bash
    npm create vite@latest ui -- --template react-ts
    ```
3.  **Install UI Dependencies:**
    ```bash
    cd ui
    npm install
    ```
4.  **Test the Standalone UI:**
    ```bash
    # Still inside the 'ui' directory
    npm run dev
    ```
    Verify it runs on `http://localhost:5173`. Stop the server (**Ctrl+C**).

### Step 2: 🔧 Configure Vite for Production Builds

While Vite's dev server (`npm run dev`) works out-of-the-box for HMR, we still need to configure how Vite creates the *production* build (`npm run build`) which will be packaged with the extension.

1.  **Open `ui/vite.config.ts`:**
2.  **Modify the Configuration:** Ensure the configuration looks like this:
    ```typescript
    // Inside ui/vite.config.ts
    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'

    // https://vitejs.dev/config/
    export default defineConfig({
      plugins: [react()],
      // Base path needs to be relative for production build
      base: './',
      build: {
        // Output directory relative to the extension's root
        // Puts the built files in 'e2view-ext/ui-dist'
        outDir: '../ui-dist',
        // Optional: Enable minification and source maps for production
        minify: true,
        sourcemap: true, // Enable source maps for easier debugging of prod build if needed
        rollupOptions: {
            output: {
                // Use hashes in production for cache busting
                entryFileNames: `assets/[name]-[hash].js`,
                chunkFileNames: `assets/[name]-[hash].js`,
                assetFileNames: `assets/[name]-[hash].[ext]`
            }
        }
      }
    })
    ```
    *Key Changes Explained:*
        *   **`base: './'`**: Still crucial for relative paths in the production build.
        *   **`build.outDir: '../ui-dist'`**: Output directory name changed to `ui-dist` (matching `src/extension.ts`) and located one level up (in the extension root).
        *   **`minify: true`, `sourcemap: true`**: Set appropriately for a production build.
        *   **`rollupOptions.output...`**: Re-enabled filename hashing (`-[hash]`) for production builds, which is standard practice. Our `extension.ts` will need to find these hashed files.
3.  **Perform an Initial Production Build:**
    ```bash
    # Make sure you are still in the 'ui' directory
    npm run build
    ```
    This creates/updates the `ui-dist` folder in your extension root. It should contain `index.html` and `assets/` with hashed JS/CSS filenames.

### Step 3: 🔌 Modify `extension.ts` to Load React App (Dev vs. Prod)

This is the most significant change. We update `src/extension.ts` to load directly from the **Vite Dev Server** during development and from the **`ui-dist` build artifacts** during production.

1.  **Open `src/extension.ts`:** (In the root `src` folder).
2.  **Ensure Imports:** Make sure you have the necessary imports at the top:
    ```typescript
    import * as vscode from 'vscode';
    import * as path from 'path';
    import * as fs from 'fs'; // Needed for reading build directory
    ```
3.  **Update `createWebviewPanel` Options:** Modify the `createWebviewPanel` call to allow loading from `ui-dist` (for production builds) and potentially other sources if needed.
    ```typescript
    // Inside src/extension.ts - within the activate function's command registration

    const panel = vscode.window.createWebviewPanel(
        'e2viewPanel',
        'e2view Viewer',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            // Allow the webview to load resources from the 'ui-dist' directory
            // and potentially from the Vite dev server's origin during development
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'ui-dist'),
                // If you load other local resources, add their URIs here
            ]
        }
    );

    // Pass context to getWebviewContent to determine mode
    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri, context);

    // Optional: Add message handling (covered in Step 3 doc)
    panel.webview.onDidReceiveMessage(/* ... */);
    ```
    *Key Change:* `localResourceRoots` primarily points to `ui-dist`. Access to the dev server (`localhost:5173`) will be controlled via the Content Security Policy.
4.  **Replace `getWebviewContent` Function:** Replace the *entire* `getWebviewContent` function (and its helper `getNonce`) with the version below, which handles both development and production modes.

    ```typescript
    // Inside src/extension.ts (replace the old getWebviewContent and add getNonce)

    function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, context: vscode.ExtensionContext): string {
        const isDevelopment = context.extensionMode === vscode.ExtensionMode.Development;

        let scriptUri: vscode.Uri | string;
        let styleUri: vscode.Uri | string = '';
        const nonce = getNonce();

        // Define URIs for Vite dev server (development)
        const viteBaseUrl = 'http://localhost:5173';
        const viteClientUri = `${viteBaseUrl}/@vite/client`;
        const viteReactRefreshUri = `${viteBaseUrl}/@react-refresh`;
        const mainScriptUriDev = `${viteBaseUrl}/src/main.tsx`; // Adjust if your entry point is different

        if (isDevelopment) {
            // In development, point to the Vite dev server URLs
            scriptUri = mainScriptUriDev;
            // Styles are injected by Vite HMR, no separate CSS link needed usually
        } else {
            // In production, get URIs for the built assets
            const assetsPath = vscode.Uri.joinPath(extensionUri, 'ui-dist', 'assets');
            let jsFile = '';
            let cssFile = '';
            try {
                const assetFiles = fs.readdirSync(assetsPath.fsPath);
                jsFile = assetFiles.find(f => f.endsWith('.js')) || '';
                cssFile = assetFiles.find(f => f.endsWith('.css')) || '';

                if (!jsFile) throw new Error("Built JS file not found.");

                scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, jsFile));
                if (cssFile) {
                    styleUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, cssFile));
                }

            } catch (e) {
                console.error("Error reading ui-dist/assets directory:", e);
                return `<html><body>Error loading production assets. Did you run 'npm run build' in the 'ui' folder? Error: ${e}</body></html>`;
            }
        }

        // Construct the Content Security Policy
        const cspSource = webview.cspSource;
        const connectSrc = isDevelopment ? `${viteBaseUrl} ws://localhost:5173` : "'self'";
        // Note: 'unsafe-eval' needed for Vite HMR source maps in dev.
        const scriptSrc = isDevelopment
            ? `'self' ${viteBaseUrl} 'unsafe-inline' 'unsafe-eval'` // Allow Vite scripts and inline modules
            : `'nonce-${nonce}' 'strict-dynamic'`; // Use nonce for built scripts
        // Allow inline styles for dev HMR, use webview URI for prod CSS file
        const styleSrc = isDevelopment
             ? `${cspSource} ${viteBaseUrl} 'unsafe-inline'`
             : `'self' ${styleUri ? webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'ui-dist', 'assets')).toString() : ''} 'unsafe-inline'`; // Allow built CSS + inline for libraries
        const imgSrc = `${cspSource} ${isDevelopment ? viteBaseUrl : ''} http: https: data:`;
        const fontSrc = `${cspSource} ${isDevelopment ? viteBaseUrl : ''}`;

        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <!-- Block everything by default -->
        <meta http-equiv="Content-Security-Policy" content="
            default-src 'none';
            connect-src ${connectSrc};
            img-src ${imgSrc};
            font-src ${fontSrc};
            script-src ${scriptSrc} ${isDevelopment ? '' : `'nonce-${nonce}'`};
            style-src ${styleSrc};
        ">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <!-- Link to production CSS -->
        ${!isDevelopment && styleUri ? `<link href="${styleUri}" rel="stylesheet">` : ''}

        <title>e2view Viewer</title>

        <!-- Load Vite client and React refresh preamble in development -->
        ${isDevelopment ? `
            <script type="module" nonce="${nonce}" src="${viteClientUri}"></script>
            <script type="module" nonce="${nonce}">
                import RefreshRuntime from '${viteReactRefreshUri}';
                RefreshRuntime.injectIntoGlobalHook(window);
                window.$RefreshReg$ = () => {};
                window.$RefreshSig$ = () => (type) => type;
                window.__vite_plugin_react_preamble_installed__ = true;
            </script>
        ` : ''}
    </head>
    <body>
        <noscript>You need to enable JavaScript to run this app.</noscript>
        <div id="root"></div>

        <!-- Load the main script -->
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
    }

    // Helper function to generate a random nonce
    function getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
    ```
    *Key Changes Explained:*
        *   **`isDevelopment` Check:** Uses `context.extensionMode` to switch logic.
        *   **Development Mode URIs:** Defines constants for Vite dev server URLs (`localhost:5173`). The main script URI points directly to your source entry file (`ui/src/main.tsx`).
        *   **Production Mode URIs:** Reads the `ui-dist/assets` directory to find the *actual* hashed filenames generated by the build. Uses `webview.asWebviewUri` for these. Includes error handling if build files are missing.
        *   **Nonce:** Generated and used consistently, especially critical for the production `script-src`.
        *   **Content Security Policy (CSP):** Significantly different between modes:
            *   **Dev:** Allows connections (`connect-src`) to the Vite server (incl. WebSockets `ws:`), allows scripts (`script-src`) from `localhost:5173` and requires `'unsafe-eval'` for source maps/HMR. Allows inline styles (`style-src`) as Vite injects styles this way.
            *   **Prod:** More restrictive. Allows connections only to `'self'`, uses the `nonce` for the main script (`script-src 'nonce-${nonce}'`), and allows styles from the built CSS file's origin (`webview.cspSource`) and inline styles.
        *   **HTML Structure:** Conditionally includes the Vite client and React Refresh scripts only in development mode. Conditionally includes the `<link>` tag for the built CSS file only in production mode.

### Step 4: ✨ Modify the Basic React Component

(This step remains the same - modify `ui/src/App.tsx` to show some basic content)

1.  **Open `ui/src/App.tsx`:**
2.  **Simplify and Modify:**
    ```tsx
    // Inside ui/src/App.tsx
    import './App.css'

    function App() {
      return (
        <>
          <h1>e2view React UI (Dev Mode)</h1>
          <p>Hello from the React component inside the VS Code Webview!</p>
          <p>Try editing App.tsx in the ui/src folder and watch this update!</p>
        </>
      )
    }

    export default App
    ```

### Step 5: ✅ Build and Test (Dev vs. Prod)

Testing now involves two scenarios:

**A) Development Mode (with HMR):**

1.  **Start Vite Dev Server:** Open a terminal **inside the `ui` directory** and run:
    ```bash
    # In the 'ui' directory
    npm run dev
    ```
    Leave this terminal running. It will serve your UI on `http://localhost:5173` and watch for changes.
2.  **Start Debugging Extension:** In the main VS Code window (editing `extension.ts`), press **`F5`** (or `Run -> Start Debugging`). This compiles `extension.ts` and opens the Extension Development Host window. Because you started debugging, `context.extensionMode` will be `Development`.
3.  **Run the Command:** In the *new* Extension Development Host window, run **`e2view: Open Viewer`**.
4.  **Verify:** The panel should open and load the UI *from the dev server*. You should see your "e2view React UI (Dev Mode)" content.
5.  **Test HMR:** Make a small visible change in `ui/src/App.tsx` (e.g., change the text) and save the file. The content in the Webview panel should update almost instantly *without* needing a full page reload.
6.  **Stop:** Stop the Vite dev server (**Ctrl+C** in its terminal) and stop the debugger (**Shift+F5**).

**B) Production Mode (Packaged):**

1.  **Build the UI:** Ensure the Vite dev server is *not* running. Open a terminal **inside the `ui` directory** and run:
    ```bash
    # In the 'ui' directory
    npm run build
    ```
    This creates/updates the production files in `ui-dist`.
2.  **Start Debugging Extension:** Press **`F5`**.
3.  **Run the Command:** In the Extension Development Host window, run **`e2view: Open Viewer`**.
4.  **Verify:** The panel should open and load the UI from the *built files* in `ui-dist`. It should look the same as the dev version (though the heading might still say "Dev Mode" if you didn't change it). HMR will *not* work in this mode. This simulates how the extension would behave when installed by an end-user.
5.  **Stop:** Stop the debugger (**Shift+F5**).

**🎉 Success! 🎉** You now have a robust setup that provides a fast development experience with HMR and correctly loads optimized build artifacts for production.

---

## 🚀 Where We Are & Next Steps

We now have:

1.  A VS Code extension command (`e2view: Open Viewer`).
2.  A separate React UI project (`ui/`).
3.  A build process (`npm run build`) for production assets (`ui-dist/`).
4.  Extension code (`src/extension.ts`) that intelligently loads the UI from the **Vite dev server** (for HMR) during development or from the **built assets** in production, using appropriate CSPs for each mode.

The next logical step, covered in `mvp-step-3-hmr-and-communication.md`, is to establish **two-way communication** between the extension process (`extension.ts`) and the React app (Webview). 