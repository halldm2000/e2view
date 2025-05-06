// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "e2view-ext" is now active!');

	// Register the command to open the viewer
	const disposable = vscode.commands.registerCommand('e2view.open', () => {
		// Create and show a new webview panel
		const panel = vscode.window.createWebviewPanel(
			'e2viewPanel', // Internal ID for the panel type
			'e2view Viewer', // Title shown in the panel tab
			vscode.ViewColumn.One, // Show the panel in the first editor column
			{
				// Enable scripts in the webview
				enableScripts: true,
				// Restrict the webview to only loading content from our ui-dist directory.
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'ui-dist')]
			}
		);

		// Set the webview's initial HTML content
		panel.webview.html = getWebviewContent(panel.webview, context.extensionUri, context);

        // Optional: Handle messages from the webview (React app)
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );

        // Optional: Clean up resources when the panel is closed
        panel.onDidDispose(
            () => {
                // Clean up resources (if any)
                console.log("e2view panel disposed");
            },
            null,
            context.subscriptions
        );
	});

	context.subscriptions.push(disposable);
}

// Function to generate the HTML content for the webview
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, context: vscode.ExtensionContext): string {
    // Detect development mode properly
    const isDevelopment = context.extensionMode === vscode.ExtensionMode.Development;

    let scriptUri: vscode.Uri | string;
    let styleUri: vscode.Uri | string = '';
    const viteClientUri = 'http://localhost:5173/@vite/client';
    const mainScriptUri = 'http://localhost:5173/src/main.tsx';

    if (isDevelopment) {
        scriptUri = mainScriptUri;
    } else {
        const scriptPath = vscode.Uri.joinPath(extensionUri, 'ui-dist', 'assets', 'index.js');
        const stylePath = vscode.Uri.joinPath(extensionUri, 'ui-dist', 'assets', 'index.css');
        scriptUri = webview.asWebviewUri(scriptPath);
        styleUri = webview.asWebviewUri(stylePath);
    }

    // Generate a nonce for CSP
    const nonce = getNonce();

    // Construct the CSP string based on the mode
    const cspSource = webview.cspSource;
    const connectSrc = isDevelopment ? 'http://localhost:5173 ws://localhost:5173' : cspSource;
    const scriptSrc = isDevelopment 
        ? `'self' http://localhost:5173 'unsafe-eval' 'nonce-${nonce}'` 
        : `'nonce-${nonce}'`;
    const styleSrc = isDevelopment 
        ? `'self' 'unsafe-inline' http://localhost:5173` 
        : webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'ui-dist')).toString();
    const imgSrc = `${cspSource} http: https: data: http://localhost:5173`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        connect-src ${connectSrc};
        img-src ${imgSrc};
        script-src ${scriptSrc};
        style-src ${styleSrc};
    ">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    ${!isDevelopment && styleUri ? `<link href="${styleUri}" rel="stylesheet">` : ''}

    <title>e2view Viewer</title>

    ${isDevelopment ? `
        <script type="module" nonce="${nonce}" src="${viteClientUri}"></script>
        <script type="module" nonce="${nonce}">
            import RefreshRuntime from 'http://localhost:5173/@react-refresh';
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

// This method is called when your extension is deactivated
export function deactivate() {}
