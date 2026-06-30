import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

const tg = window.Telegram?.WebApp;

// --- Safe area from Telegram + device ---
function updateSafeArea() {
  // contentSafeAreaInset — Telegram's own UI chrome (X button, ... menu)
  const tgContentTop = tg?.contentSafeAreaInset?.top ?? 0;
  // safeAreaInset — device system safe area (notch, status bar)
  const tgSafeTop = tg?.safeAreaInset?.top ?? 0;

  const tgContentBottom = tg?.contentSafeAreaInset?.bottom ?? 0;
  const tgSafeBottom = tg?.safeAreaInset?.bottom ?? 0;

  // Set the individual Telegram vars so CSS --sa-top can pick them up via max()
  document.documentElement.style.setProperty(
    "--tg-content-safe-area-inset-top",
    tgContentTop > 0 ? tgContentTop + "px" : "0px"
  );
  document.documentElement.style.setProperty(
    "--tg-safe-area-inset-top",
    tgSafeTop > 0 ? tgSafeTop + "px" : "0px"
  );
  document.documentElement.style.setProperty(
    "--tg-safe-area-inset-bottom",
    tgSafeBottom > 0 ? tgSafeBottom + "px" : "0px"
  );
  document.documentElement.style.setProperty(
    "--tg-content-safe-area-inset-bottom",
    tgContentBottom > 0 ? tgContentBottom + "px" : "0px"
  );

  // Also set --safe-top for legacy references
  const topPx = Math.max(tgContentTop, tgSafeTop);
  document.documentElement.style.setProperty(
    "--safe-top",
    topPx > 0 ? topPx + "px" : "0px"
  );

  // Set --sa-top directly so inline style overrides the CSS sheet value.
  // iOS Telegram chrome (status bar ~47px + mini-app bar ~44px) = ~91px.
  // Android Telegram chrome is smaller (~56px). Use platform-aware minimum.
  const isIos =
    tg?.platform === "ios" ||
    /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const minSaTop = isIos ? 90 : 56;
  const saTop = Math.max(tgContentTop, tgSafeTop, minSaTop);
  document.documentElement.style.setProperty("--sa-top", saTop + "px");

  // Bottom safe area
  const bottomPx = Math.max(tgContentBottom, tgSafeBottom);
  document.documentElement.style.setProperty(
    "--safe-bottom",
    bottomPx > 0 ? bottomPx + "px" : "0px"
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
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
