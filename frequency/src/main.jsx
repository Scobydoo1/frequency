import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/spectral/300.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/500.css";
import "@fontsource/spectral/300-italic.css";
import "@fontsource/spectral/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles.css";
import App from "./App.jsx";

// keep centered screens above the on-screen keyboard on mobile
if (window.visualViewport) {
  const setVVH = () =>
    document.documentElement.style.setProperty("--vvh", `${window.visualViewport.height}px`);
  window.visualViewport.addEventListener("resize", setVVH);
  setVVH();
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
