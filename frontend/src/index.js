import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Telegram Mini App initialization
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;

  // Force full-screen mode
  tg.expand();

  // Prevent accidental closing via confirmation dialog
  tg.enableClosingConfirmation();

  // Disable vertical swipes to close (Telegram API 7.7+)
  if (typeof tg.disableVerticalSwipes === "function") {
    tg.disableVerticalSwipes();
  } else if ("isVerticalSwipesEnabled" in tg) {
    tg.isVerticalSwipesEnabled = false;
  }
}

// CSS fallback: block overscroll/pull-to-refresh at the DOM level
document.documentElement.style.overscrollBehavior = "none";
document.body.style.overscrollBehavior = "none";

// JS fallback: prevent touchmove from propagating past the root element
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) return; // allow pinch-zoom
    const el = e.target;
    const isScrollable = (node) => {
      if (!node || node === document.body) return false;
      const style = window.getComputedStyle(node);
      const overflow = style.overflowY;
      const canScroll = overflow === "auto" || overflow === "scroll";
      if (canScroll && node.scrollHeight > node.clientHeight) return true;
      return isScrollable(node.parentElement);
    };
    if (!isScrollable(el)) {
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
