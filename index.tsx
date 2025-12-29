import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import * as genai from "@google/genai";
// Lazy load the main App component
const App = React.lazy(() => import("./App"));

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const LoadingScreen = () => (
  <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center text-green-500 font-mono">
    <div className="animate-pulse text-xl">INITIALIZING SYSTEM...</div>
    <div className="mt-2 text-xs opacity-70">LOADING MODULES</div>
  </div>
);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* <Suspense fallback={<LoadingScreen />}> */}
    <App />
    {/* </Suspense> */}
  </React.StrictMode>
);
