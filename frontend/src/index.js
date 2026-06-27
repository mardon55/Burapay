import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// --- Telegram WebApp Full Screen & Swipe Lock ---
function applyTelegramSettings() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  // 1. Expand to full available height
  tg.expand();

  // 2. True full-screen — hides Telegram header (Bot API 8.0+)
  //    Try both naming conventions (capital vs lowercase 's')
  try {
    if (typeof tg.requestFullscreen === "function") {
      tg.requestFullscreen();
    } else if (typeof tg.requestFullScreen === "function") {
      tg.requestFullScreen();
    }
  } catch (e) {
    // Silently ignore if not supported
  }

  // 3. Disable vertical swipe-to-close (Android critical fix)
  try {
    if (typeof tg.disableVerticalSwipes === "function") {
      tg.disableVerticalSwipes();
    }
    tg.isVerticalSwipesEnabled = false;
  } catch (e) {}

  // 4. Show closing confirmation dialog
  try { tg.enableClosingConfirmation(); } catch (e) {}
}

// --- window.innerHeight binding (Android dynamic toolbar fix) ---
function setAppHeight() {
  const h = window.innerHeight;
  document.documentElement.style.setProperty("--app-height", h + "px");
  // Also update Telegram's own variable if available
  if (window.Telegram?.WebApp?.viewportStableHeight) {
    document.documentElement.style.setProperty(
      "--tg-viewport-stable-height",
      window.Telegram.WebApp.viewportStableHeight + "px"
    );
  }
}

// Run on load
applyTelegramSettings();
setAppHeight();

// Re-run on resize (Android Chrome hides/shows toolbar changing innerHeight)
window.addEventListener("resize", setAppHeight);

// Re-run on Telegram viewport change
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.onEvent("viewportChanged", () => {
    window.Telegram.WebApp.expand();
    setAppHeight();
  });
}

// --- CSS: block overscroll at DOM level ---
document.documentElement.style.overscrollBehavior = "none";
document.body.style.overscrollBehavior = "none";

// --- Block touchmove on non-scrollable elements ---
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
    if (!isScrollable(e.target)) {
      e.preventDefault();
    }
  },
  { passive: false }
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
