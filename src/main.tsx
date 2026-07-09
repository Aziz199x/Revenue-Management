import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "@/components/shared/ErrorBoundary";
import App from "./App.tsx";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
