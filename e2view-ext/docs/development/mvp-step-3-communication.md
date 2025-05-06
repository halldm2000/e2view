# MVP Step 3: Webview <-> Extension Communication

This guide follows `mvp-step-2-react-webview.md`. We now have a VS Code extension that loads a React UI into a Webview panel, complete with Hot Module Replacement (HMR) for a smooth development experience.

The next crucial step is enabling communication between the **Extension Backend** (your TypeScript code in `src/extension.ts`) and the **Webview Frontend** (your React code in `ui/src/`). This allows the UI to request actions from the extension (e.g., "load this file") and the extension to send data to the UI (e.g., "here is the data you requested", "model run complete").

We'll use the standard VS Code Webview API for this, which involves sending and receiving JSON messages.

---

## 🛠️ Prerequisites

*   Completion of `mvp-step-2-react-webview.md` (including the HMR setup).
*   Understanding of the development workflow (running `npm run dev` in `ui/` + `F5` debugging).
*   Basic understanding of React functional components and hooks.

---

## 🔁 The Communication Mechanism: `postMessage`

VS Code Webviews run in an isolated context, separate from the extension's main process. They cannot directly call functions or access variables in `extension.ts`, and vice-versa.

Instead, they communicate by sending asynchronous messages using a `postMessage` API:

1.  **Extension -> Webview:** The `extension.ts` code calls `panel.webview.postMessage({ command: '...', data: '...' })`.
2.  **Webview -> Extension:** The React app code calls `vscode.postMessage({ command: '...', payload: '...' })` (using a special `vscode` object provided within the Webview).

Messages are typically simple JSON objects containing a `command` field (a string identifying the message type) and some data payload.

---

## 📝 Implementing Communication Step-by-Step

### Step 1: Sending Messages from Webview (React) to Extension

Let's add a button in our React UI that sends a message to the extension when clicked.

1.  **Acquire VS Code API in React:** The Webview environment provides a special function `acquireVsCodeApi()` that returns an object with a `postMessage` method. We need to call this function *only once* and store the result.

    Modify `ui/src/App.tsx`:
    ```tsx
    // Inside ui/src/App.tsx
    import { useEffect, useState } from 'react';
    import './App.css';

    // Acquire the VS Code API object (only call this once)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vscode: any = (window as any).acquireVsCodeApi();

    function App() {
      const [messageFromExtension, setMessageFromExtension] = useState<string>('');

      // Handler for messages from the extension
      useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data; // The JSON data sent from the extension
            console.log("Message received from extension:", message);
            switch (message.command) {
                case 'updateMessage':
                    setMessageFromExtension(message.data);
                    break;
                // Add more cases for other commands from the extension
            }
        };

        window.addEventListener('message', handleMessage);

        // Cleanup function to remove the listener when the component unmounts
        return () => {
            window.removeEventListener('message', handleMessage);
        };
      }, []); // Empty dependency array ensures this runs only once

      // Function to send a message to the extension
      const sendMessageToExtension = () => {
        vscode.postMessage({
            command: 'buttonClick',
            payload: `Hello from React at ${new Date().toLocaleTimeString()}`
        });
      };

      return (
        <>
          <h1>e2view React UI</h1>
          <p>Communication Example</p>

          <button onClick={sendMessageToExtension}>
            Send Message to Extension
          </button>

          <h2>Message from Extension:</h2>
          <p>{messageFromExtension || 'Waiting for message...'}</p>
        </>
      )
    }

    export default App
    ```
    *Key Changes:*
        *   **`acquireVsCodeApi()`**: Called outside the component to get the `vscode` object.
        *   **`vscode.postMessage(...)`**: Called inside `sendMessageToExtension` to send a message object with a `command` and `payload` to the extension.
        *   **`useEffect` and `window.addEventListener('message', ...)`**: Added a listener to receive messages *from* the extension (we'll implement the sending part next). It updates component state (`messageFromExtension`) based on received commands.
        *   **Cleanup:** The `useEffect` hook returns a cleanup function to remove the event listener, preventing memory leaks.

2.  **Handle Messages in Extension (`extension.ts`):** We already have a basic message handler in `src/extension.ts`. Let's modify it to specifically react to our `buttonClick` command.

    Update the `panel.webview.onDidReceiveMessage` block inside the `activate` function in `src/extension.ts`:
    ```typescript
    // Inside src/extension.ts activate function

    // ... (panel creation code) ...

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        message => {
            console.log("Message received from webview:", message);
            switch (message.command) {
                case 'alert': // Keep existing example if needed
                    vscode.window.showErrorMessage(message.text);
                    return;
                case 'buttonClick':
                    // Show the received payload in an info message
                    vscode.window.showInformationMessage(`Received from React: ${message.payload}`);

                    // --- Send a response back to the webview --- 
                    panel.webview.postMessage({
                        command: 'updateMessage',
                        data: `Extension received your message at ${new Date().toLocaleTimeString()}`
                    });
                    return;
                // Add more cases for other commands from the webview
            }
        },
        undefined,
        context.subscriptions
    );

    // ... (panel disposal and context.subscriptions.push) ...
    ```
    *Key Changes:*
        *   Added a `case 'buttonClick':` to the `switch` statement.
        *   When the `buttonClick` message arrives, it displays an info message using `vscode.window.showInformationMessage`.
        *   **Crucially**, it then calls `panel.webview.postMessage` to send a response back to the React UI (using the `updateMessage` command).

### Step 2: Sending Messages from Extension to Webview (React)

We just saw an example in the `buttonClick` handler: the extension calls `panel.webview.postMessage(...)` to send data back.

*   **In `extension.ts`:**
    ```typescript
    panel.webview.postMessage({ command: 'someCommand', data: { /* any JSON data */ } });
    ```
*   **In `ui/src/App.tsx` (or relevant component):** The `useEffect` hook with `window.addEventListener('message', handleMessage)` will receive this message. The `handleMessage` function needs a `case` in its `switch` statement to handle `someCommand`.

    ```javascript
    // Inside the handleMessage function in App.tsx
    switch (message.command) {
        // ... other cases
        case 'someCommand':
            console.log("Received someCommand with data:", message.data);
            // Update state, trigger actions, etc.
            break;
    }
    ```

### Step 3: Testing Communication

1.  **Ensure `extension.ts` and `ui/src/App.tsx` are saved** with the changes above.
2.  **Start Dev Server:** In the `ui` directory terminal: `npm run dev`.
3.  **Start Debugging:** Press `F5` in the main VS Code window.
4.  **Run Command:** In the Extension Development Host window, run `e2view: Open Viewer`.
5.  **Click the Button:** In the Webview panel, click the "Send Message to Extension" button.
6.  **Verify:**
    *   You should see a VS Code information message pop up: "Received from React: Hello from React at ...".
    *   Almost immediately after, the text in the Webview panel should change from "Waiting for message..." to "Extension received your message at ...".
    *   Check the console logs: In the Webview Developer Tools (`Developer: Open Webview Developer Tools`), you should see the "Message received from extension..." log. In the main VS Code debug console (`Debug Console` tab), you should see the "Message received from webview..." log.

**🎉 Success! 🎉** You have established two-way communication between your extension and your React UI.

---

## 💡 Tips and Best Practices

*   **Define Message Interfaces:** Use TypeScript interfaces for your message objects in both `extension.ts` and the React app (`ui/src/`) to ensure consistency and catch errors.
    ```typescript
    // Example: Define in a shared types file or separately
    interface VsCodeMessage {
        command: string;
        payload?: any;
    }

    interface WebviewMessage {
        command: string;
        data?: any;
    }
    ```
*   **Clear Command Names:** Use descriptive `command` strings.
*   **Error Handling:** Consider what happens if `postMessage` fails or if the receiving side doesn't handle a specific command.
*   **State Management:** For complex UIs, manage the state derived from extension messages using a proper state management library (Zustand, Redux, Context API) in your React app.
*   **VS Code API Wrapper:** For cleaner code in React, you can wrap the `acquireVsCodeApi().postMessage` call in a custom hook or utility function.

---

## 🚀 Next Steps

With communication established, you can now build real features:

1.  **UI -> Extension:** Add UI elements (buttons, forms) to trigger actions in the extension (e.g., request file loading, start a model run).
2.  **Extension -> UI:** Send data resulting from these actions back to the UI for display (e.g., file content, job status updates, model output visualization data).
3.  **Build UI Components:** Develop the actual map viewers, data controls, etc., within the React application. 