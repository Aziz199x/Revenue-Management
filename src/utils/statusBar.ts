import { Capacitor } from "@capacitor/core";

/**
 * Configures the native status bar (Android/iOS) so it never overlays
 * the WebView content. On web this is a no-op.
 */
export async function setupStatusBar() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#f0f9f6" });
  } catch {
    // StatusBar plugin unavailable, ignore
  }
}
