import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Update CSS variable for Telegram viewport height
function setViewportHeight() {
  if (window.Telegram?.WebApp?.viewportStableHeight) {
    document.documentElement.style.setProperty(
      "--tg-viewport-stable-height",
      window.Telegram.WebApp.viewportStableHeight + "px"
    );
  }
}

// Telegram Mini App initialization
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;

  // 1. Force full-screen (expands viewport to fill Telegram window)
  tg.expand();

  // 2. True full-screen — hides Telegram header bar (Bot API 8.0+)
  if (typeof tg.requestFullScreen === "function") {
    tg.requestFullScreen();
  }

  // 3. Disable swipe-down-to-close gesture (API 7.7+)
  if (typeof tg.disableVerticalSwipes === "function") {
    tg.disableVerticalSwipes();
  } else if ("isVerticalSwipesEnabled" in tg) {
    tg.isVerticalSwipesEnabled = false;
  }

  // 4. Show confirmation dialog on accidental close attempt
  tg.enableClosingConfirmation();

  // 5. Set initial viewport height
  setViewportHeight();

  // 6. Update viewport height on change (keyboard open/close etc.)
  tg.onEvent("viewportChanged", () => {
    tg.expand();
    setViewportHeight();
  });
}

// CSS fallback: block overscroll / pull-to-refresh at the DOM level
document.documentElement.style.overscrollBehavior = "none";
document.body.style.overscrollBehavior = "none";

// JS fallback: prevent touchmove on non-scrollable elements
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
  </React.StrictMode>,
);
