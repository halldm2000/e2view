import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

// Acquire the VS Code API object (only call this once)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode: any = (window as any).acquireVsCodeApi();

function App() {
  const [count, setCount] = useState(0)
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
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>

      <button onClick={sendMessageToExtension}>
        Send Message to Extension
      </button>

      <h2>Message from Extension:</h2>
      <p>{messageFromExtension || 'Waiting for message...'}</p>
    </>
  )
}

export default App
