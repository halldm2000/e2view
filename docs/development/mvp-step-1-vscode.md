# MVP Step 1: Building the Basic VS Code Extension Shell and Webview for e2view

This guide provides detailed steps to create the very first version of our e2view tool as a VS Code extension. Think of a VS Code extension like a plugin that adds new features to the editor. Our goal here is just to get a basic custom panel (called a "Webview") showing up inside VS Code when we run a command. We won't load any real weather data yet; this is just about setting up the skeleton for e2view.

We assume you are comfortable with Python but might be new to the tools used here (Node.js, npm, TypeScript, React) and VS Code extension development.

---

## 🛠️ Prerequisites: Tools We Need

Before starting, you'll need a couple of software tools installed. These are standard for modern web and VS Code extension development.

1.  **Node.js and npm:** Node.js is a runtime environment that lets you run JavaScript code outside of a web browser (similar to how you run Python scripts). **`npm`** (Node Package Manager) comes bundled with Node.js and is used to install and manage project libraries (dependencies), much like `pip` and `requirements.txt` or `pyproject.toml` in the Python world.
    *   **Check Installation:** Open your terminal or command prompt and type `node -v` and `npm -v`. If you see version numbers, you're good to go.
    *   **Installation:** If not installed, download and install Node.js (which includes npm) from [nodejs.org](https://nodejs.org/). Choose the LTS (Long-Term Support) version.
2.  **Visual Studio Code (VS Code):** The code editor we are building the extension for. Download from [code.visualstudio.com](https://code.visualstudio.com/).
3.  **Git (Recommended):** For version control. While not strictly needed for this *first* step, it's essential for any real project.

---

## 📝 Core Tasks Explained Step-by-Step

### Step 1: 📁 Set Up the Project Folders

First, we need to organize our project files. Keeping things in dedicated folders makes the project easier to manage as it grows.

1.  **Create a Main Project Folder:** Create a new folder somewhere on your computer for the entire project. Let's call it **`e2view`**. Open this `e2view` folder in VS Code (`File -> Open Folder...`).
2.  **Create the Extension Subfolder:** Inside the `e2view` folder, create a new folder named **`extensions`**. Inside `extensions`, create another folder named **`vscode`**. Your structure should look like this:
    ```text
    e2view/
    └── extensions/
        └── vscode/
    ```
    All the code specific to the VS Code extension will live inside this `extensions/vscode` directory.

### Step 2: ⚙️ Generate the Basic VS Code Extension Code (using `npx`)

Instead of creating all the necessary configuration files manually, we'll use a tool to generate a standard VS Code extension template. We'll use **`npx`**, a tool included with `npm`, which lets us run packages without installing them permanently all over our system.

1.  **(Prerequisite Check):** Ensure Node.js and `npm` are installed on your system (as mentioned in the Prerequisites section). This initial installation provides the `npx` command.

2.  **Navigate to the Extension Folder:** Open your terminal or PowerShell in VS Code (`Terminal -> New Terminal`) and change directory into the folder we created:
    ```powershell
    cd extensions/vscode
    ```
3.  **Run the Generator using `npx`:** Execute the Yeoman VS Code generator directly using `npx`. This command temporarily downloads and runs `yo` and `generator-code` just for this operation:
    ```powershell
    npx -p yo -p generator-code yo code
    ```
    *What's happening:*
        *   **`npx`**: Tells Node.js to execute a package command, downloading it temporarily if needed.
        *   **`-p yo -p generator-code`**: Specifies the packages (`yo` and `generator-code`) required for the command.
        *   **`yo code`**: The actual command to run using those packages.
    *Why:* This avoids cluttering your system with globally installed tools. The generator starts an interactive wizard in your terminal.
4.  **Answer the Wizard's Questions:**
    *   `What type of extension do you want to create?` Choose **`New Extension (TypeScript)`**. (TypeScript adds static types to JavaScript, like Python type hints).
    *   `What's the name of your extension?` Enter **`e2view`**.
    *   `What's the identifier of your extension?` Use the default or enter **`e2view`**.
    *   `What's the description of your extension?` Enter a short description, e.g., **`Displays Earth-2 model outputs using e2view`**.
    *   `Initialize a git repository?` Choose **`Yes`** if you use Git, **`No`** otherwise for now.
    *   `Bundle the source code with webpack?` Choose **`No`** for simplicity in this initial setup. We'll use Vite later for the UI part.
    *   `Which package manager to use?` Choose **`npm`**.
    *What:* This generates the core files for the extension inside `extensions/vscode`:
        *   **`package.json`**: The project manifest (metadata, dependencies, commands).
        *   **`src/extension.ts`**: The main entry point for your extension code.
        *   **`tsconfig.json`**: TypeScript configuration.
5.  **Install Local Project Dependencies:** The generator created **`package.json`** listing libraries needed *specifically for this extension*. Now, install these into a local **`node_modules`** folder within `extensions/vscode`:
    ```powershell
    npm install
    ```
    *Why:* This keeps the extension's dependencies isolated, similar to a Python virtual environment (`venv`).

### Step 3: ⌨️ Define a Command for Users

We need a way for users to activate our extension's panel. We'll define a "command" that they can run from the VS Code Command Palette (**Ctrl+Shift+P**).

1.  **Open `extensions/vscode/package.json`:** Find the `contributes` section in this file. Inside `contributes`, find the `commands` array (if it doesn't exist, you'll need to add the `contributes` object and the `commands` array within it).
2.  **Add the Command Definition:** Add an object to the `commands` array like this:
    ```json
    // Inside extensions/vscode/package.json
    {
      // ... other package.json content ...
      "contributes": {
        "commands": [
          {
            "command": "e2view.open", // Unique ID for the command
            "title": "e2view: Open Viewer"  // Text shown to the user
          }
        ]
        // Potentially other contributions like menus later
      },
      // ... other package.json content ...
    }
    ```
    *Why:* This registers our command with VS Code. **`command`** is the internal ID we'll use in our code, and **`title`** is the human-readable text that appears in the Command Palette.
3.  **Connect Command to Activation:** Find the **`activationEvents`** array in `package.json`. Make sure it includes an entry for our command. If the array isn't there, add it. This tells VS Code to activate (load) our extension's code *only* when this command is about to be run, saving resources.
    ```json
    // Inside extensions/vscode/package.json
    {
      // ... other package.json content ...
      "activationEvents": [
        "onCommand:e2view.open" // Note the "onCommand:" prefix
      ],
      // ... other package.json content ...
    }
    ```
    *Why:* This ensures our extension code isn't running all the time, only when needed.

### Step 4: ✍️ Write Code to Open a Panel When the Command Runs

Now we need to write the TypeScript code in **`src/extension.ts`** that actually does something when the `e2view.open` command is executed.

1.  **Open `extensions/vscode/src/extension.ts`:** This file contains **`activate`** and **`deactivate`** functions. The `activate` function runs when your extension is first activated (as defined by `activationEvents`).
2.  **Register the Command Handler:** Inside the `activate` function, we need to link our command ID (`e2view.open`) to a function that will run. The template likely has example code for a "Hello World" command; we'll replace or modify it.
    ```typescript
    // Inside extensions/vscode/src/extension.ts
    import * as vscode from 'vscode';

    export function activate(context: vscode.ExtensionContext) {

        console.log('Congratulations, your extension "e2view" is now active!');

        // Register our command
        let disposable = vscode.commands.registerCommand('e2view.open', () => {
            // This function runs when the command is executed
            vscode.window.showInformationMessage('Opening e2view Viewer!');

            // --- We will add code here soon to create the Webview panel ---
        });

        // Add the command registration to the extension's context
        // This ensures it's properly cleaned up when the extension is deactivated
        context.subscriptions.push(disposable);
    }

    // This method is called when your extension is deactivated
    export function deactivate() {}
    ```
    *What:* `vscode.commands.registerCommand` takes the command ID and a function (the "handler"). When the user runs the command, VS Code calls this handler function. `context.subscriptions.push(disposable)` is important for cleanup.

### Step 5: 🖼️ Create the Webview Panel

Now, inside the command handler, let's create the actual Webview panel.

1.  **Modify the Command Handler in `src/extension.ts`:**
    ```typescript
    // Inside extensions/vscode/src/extension.ts
    import * as vscode from 'vscode';

    export function activate(context: vscode.ExtensionContext) {
        console.log('Congratulations, your extension "e2view" is now active!');

        let disposable = vscode.commands.registerCommand('e2view.open', () => {
            // Create and show a new webview panel
            const panel = vscode.window.createWebviewPanel(
                'e2viewPanel', // Internal ID for the panel type
                'e2view Viewer', // Title shown in the panel tab
                vscode.ViewColumn.One, // Show the panel in the first editor column
                {
                    // Enable scripts in the webview
                    enableScripts: true
                    // We might add 'localResourceRoots' here later
                }
            );

            // --- We will set the HTML content next ---
            panel.webview.html = getWebviewContent();
        });

        context.subscriptions.push(disposable);
    }

    // Function to generate the HTML content for the webview
    function getWebviewContent(): string {
        // For now, just return simple static HTML
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- We will add a Content Security Policy meta tag here later -->
    <title>e2view Viewer</title>
</head>
<body>
    <h1>e2view Placeholder</h1>
    <p>The actual UI will be loaded here.</p>
    <!-- We will add script tags here later -->
</body>
</html>`;
    }

    export function deactivate() {}
    ```
    *What:*
        *   `vscode.window.createWebviewPanel` creates the panel where we can show web content.
        *   We give it an ID (**`e2viewPanel`**), a title (**`e2view Viewer`**), tell it where to appear (`vscode.ViewColumn.One`), and enable scripts (**`enableScripts: true`**) so we can run JavaScript for our React app later.
        *   We create a separate function **`getWebviewContent`** to keep the HTML generation organized. For now, it just returns a basic HTML structure.
        *   `panel.webview.html = getWebviewContent();` assigns the generated HTML string to the panel's content.

### Step 6: ✅ Test the Basic Extension

Let's check if the skeleton works.

1.  **Start Debugging:** In VS Code, press **`F5`** (or go to `Run -> Start Debugging`).
    *What:* This compiles your TypeScript code into JavaScript and opens a *new* VS Code window called the "Extension Development Host". This new window has your extension installed and running.
2.  **Run the Command:** In the *new* Extension Development Host window, open the Command Palette (**Ctrl+Shift+P** or **Cmd+Shift+P** on Mac). Type **`e2view: Open Viewer`** and select your command.
3.  **Verify:**
    *   You should see an information message pop up briefly (from `showInformationMessage`).
    *   A new panel tab titled "e2view Viewer" should open, displaying the text "e2view Placeholder".
4.  **Stop Debugging:** Close the Extension Development Host window. You can stop the debugger in the original window (**Shift+F5**).

**🎉 If it worked, congratulations! 🎉** You have successfully created the basic shell of a VS Code extension that can open a custom panel.

---

## 🚀 Where We Are & Next Steps (Separate Document)

We've achieved the very basic setup: a command that opens an empty-ish panel (Webview).

The next major phase (covered in a separate plan, like `mvp-step-2-react-webview.md`) involves:

1.  **Setting up a React Project:** Create a separate project (using Vite) inside `extensions/vscode` specifically for building the user interface (the map, sliders, etc.).
2.  **Loading the React App into the Webview:** Modify the `getWebviewContent` function to generate HTML that correctly loads the built JavaScript and CSS files from the React/Vite project. This involves handling security policies (CSP) and file paths correctly using VS Code APIs (`webview.asWebviewUri`).
3.  **Displaying a Basic React Component:** Make the React app render a simple component inside the Webview to confirm it's loading.

This current step focused solely on the VS Code extension structure itself. The next step will focus on building the UI and integrating it into the Webview panel we just created. 