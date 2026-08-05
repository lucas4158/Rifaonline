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

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { updateAppMetadata } from './utils/helpers';

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
    <App />
  </StrictMode>,
);
