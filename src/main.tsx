// Suppress benign Firestore BloomFilter errors/warnings before loading any other modules
const suppressKeywords = ["BloomFilter", "BloomFilterError", "Invalid hash count"];

const originalConsoleError = console.error;
console.error = function (...args: any[]) {
  const message = args.map(arg => {
    try {
      return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
    } catch (e) {
      return String(arg);
    }
  }).join(" ");
  
  if (suppressKeywords.some(kw => message.includes(kw))) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args: any[]) {
  const message = args.map(arg => {
    try {
      return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
    } catch (e) {
      return String(arg);
    }
  }).join(" ");
  
  if (suppressKeywords.some(kw => message.includes(kw))) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { updateAppMetadata } from './utils/helpers';

class GlobalErrorBoundary extends React.Component<{ children?: React.ReactNode }, { hasError: boolean; error: any }> {
  state: { hasError: boolean; error: any };

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Global Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: 'red', color: 'white', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>React Error Boundary Caught an Error!</h2>
          <p>{this.state.error?.message}</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', marginTop: '20px' }}>
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: '10px', background: 'white', color: 'black', marginTop: '20px' }}>Reload Page</button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

if (typeof window !== "undefined") {
  updateAppMetadata();
  const logClientErrorToServer = (details: any) => {
    try {
      fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "client-log", details }),
      }).catch(() => {});
    } catch (e) {}
  };

  window.onerror = function (message, source, lineno, colno, error) {
    const details = {
      type: "unhandled_error",
      message: String(message),
      source: String(source),
      lineno,
      colno,
      stack: error ? error.stack : "No stack trace available",
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    // VISIBLE ERROR OVERLAY FOR DEBUGGING
    const errDiv = document.createElement("div");
    errDiv.style.position = "fixed";
    errDiv.style.top = "0";
    errDiv.style.left = "0";
    errDiv.style.width = "100%";
    errDiv.style.height = "100%";
    errDiv.style.backgroundColor = "rgba(100, 0, 0, 0.9)";
    errDiv.style.color = "white";
    errDiv.style.zIndex = "9999999";
    errDiv.style.padding = "20px";
    errDiv.style.overflow = "auto";
    errDiv.style.fontFamily = "monospace";
    errDiv.innerHTML = `<h3>FATAL ERROR</h3><p><strong>Message:</strong> ${message}</p><p><strong>Source:</strong> ${source}:${lineno}:${colno}</p><pre style="white-space: pre-wrap; font-size: 10px;">${details.stack}</pre><button onclick="this.parentElement.remove()" style="padding: 10px; background: white; color: black; margin-top: 20px;">Dismiss</button>`;
    document.body.appendChild(errDiv);

    console.error(`[MOBILE_CLIENT_ERROR] Global error caught:`, details);
    logClientErrorToServer(details);
  };

  window.onunhandledrejection = function (event) {
    const reason = event.reason;
    const msg = reason ? (reason.message || String(reason)) : "Unhandled Promise Rejection";

    if (
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("Quota exceeded") ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("AbortError") ||
      msg.includes("pattern") ||
      msg.includes("DOMException")
    ) {
      console.warn("⚠️ [Client Notice] Transient network or background event caught:", msg);
      return;
    }

    const details = {
      type: "unhandled_rejection",
      message: msg,
      stack: (reason && reason.stack) ? reason.stack : "No stack trace available",
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    const errDiv = document.createElement("div");
    errDiv.style.position = "fixed";
    errDiv.style.top = "0";
    errDiv.style.left = "0";
    errDiv.style.width = "100%";
    errDiv.style.height = "100%";
    errDiv.style.backgroundColor = "rgba(100, 50, 0, 0.9)";
    errDiv.style.color = "white";
    errDiv.style.zIndex = "9999999";
    errDiv.style.padding = "20px";
    errDiv.style.overflow = "auto";
    errDiv.style.fontFamily = "monospace";
    errDiv.innerHTML = `<h3>UNHANDLED PROMISE REJECTION</h3><p><strong>Message:</strong> ${msg}</p><pre style="white-space: pre-wrap; font-size: 10px;">${details.stack}</pre><button onclick="this.parentElement.remove()" style="padding: 10px; background: white; color: black; margin-top: 20px;">Dismiss</button>`;
    document.body.appendChild(errDiv);

    console.warn(`[MOBILE_CLIENT_NOTICE] Unhandled Rejection caught:`, details);
    logClientErrorToServer(details);
  };

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('📡 [PWA] Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('❌ [PWA] Service Worker registration failed:', error);
        });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
