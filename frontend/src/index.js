import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const tg = window.Telegram?.WebApp;

// --- Safe area from Telegram + device ---
function updateSafeArea() {
  // contentSafeAreaInset — Telegram's own UI (close button, header bar)
  const tgContentTop = tg?.contentSafeAreaInset?.top ?? 0;
  // safeAreaInset — device system safe area (notch, status bar)
  const tgSafeTop = tg?.safeAreaInset?.top ?? 0;

  // Use the bigger of: Telegram content safe area, device safe area, or CSS env()
  // We set it as a CSS variable so the app can use it everywhere
  const topPx = Math.max(tgContentTop, tgSafeTop);
  document.documentElement.style.setProperty(
    "--safe-top",
    topPx > 0 ? topPx + "px" : "env(safe-area-inset-top, 44px)"
  );

  // Bottom safe area
  const bottomPx = tg?.safeAreaInset?.bottom ?? 0;
  document.documentElement.style.setProperty(
    "--safe-bottom",
    bottomPx > 0 ? bottomPx + "px" : "env(safe-area-inset-bottom, 0px)"
  );
}

// --- App height (Android dynamic toolbar fix) ---
function setAppHeight() {
  const h = window.innerHeight;
  document.documentElement.style.setProperty("--app-height", h + "px");
  if (tg?.viewportStableHeight) {
    document.documentElement.style.setProperty(
      "--tg-viewport-stable-height",
      tg.viewportStableHeight + "px"
    );
  }
}

// --- Telegram WebApp init ---
if (tg) {
  // 1. Expand
  tg.expand();

  // 2. Full screen (Bot API 8.0+)
  try {
    if (typeof tg.requestFullscreen === "function") tg.requestFullscreen();
    else if (typeof tg.requestFullScreen === "function") tg.requestFullScreen();
  } catch (e) {}

  // 3. Disable vertical swipes (Android)
  try {
    if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes();
    tg.isVerticalSwipesEnabled = false;
  } catch (e) {}

  // 4. Closing confirmation
  try { tg.enableClosingConfirmation(); } catch (e) {}

  // 5. Initial safe area + height
  updateSafeArea();
  setAppHeight();

  // 6. Update on viewport/safeArea change
  tg.onEvent("viewportChanged", () => {
    tg.expand();
    setAppHeight();
    updateSafeArea();
  });
  tg.onEvent("safeAreaChanged", updateSafeArea);
  tg.onEvent("contentSafeAreaChanged", updateSafeArea);
} else {
  // Browser / Replit preview fallback
  setAppHeight();
  updateSafeArea();
}

// Resize fallback
window.addEventListener("resize", setAppHeight);

// Block overscroll at DOM level
document.documentElement.style.overscrollBehavior = "none";
document.body.style.overscrollBehavior = "none";

// Block touchmove on non-scrollable elements
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) return;
    const isScrollable = (node) => {
      if (!node || node === document.body) return false;
      const { overflowY } = window.getComputedStyle(node);
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight
      )
        return true;
      return isScrollable(node.parentElement);
    };
    if (!isScrollable(e.target)) e.preventDefault();
  },
  { passive: false }
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
