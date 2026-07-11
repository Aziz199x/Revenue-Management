import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { showInfo } from "@/utils/toast";

const ROOT_PATHS = ["/", "/buildings", "/payments", "/requests", "/reports", "/settings"];

export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastBackRef = useRef<number>(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", () => {
          const openDialog = document.querySelector(
            '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
          );
          if (openDialog) {
            openDialog.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
            );
            return;
          }

          const isRoot = ROOT_PATHS.includes(location.pathname);
          if (!isRoot) {
            navigate(-1);
            return;
          }

          const now = Date.now();
          if (now - lastBackRef.current < 2000) {
            App.exitApp();
          } else {
            lastBackRef.current = now;
            showInfo("اضغط مرة أخرى للخروج");
          }
        });
        removeListener = () => listener.remove();
      } catch {
        // App plugin not available
      }
    })();

    return () => {
      if (removeListener) removeListener();
    };
  }, [navigate, location.pathname]);
}
