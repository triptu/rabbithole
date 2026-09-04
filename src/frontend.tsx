/**
 * Entry point: creates the sdk and mounts the app.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { RabbitholeContext } from "./hooks";
import { createRabbithole, type Rabbithole } from "./sdk";
import "./index.css";

declare global {
  // handy in the console: rabbithole.store.getState(), rabbithole.reader.open("tx") …
  var rabbithole: Rabbithole;
}

// A fresh sdk on every (re)evaluation, so a hot reload never keeps stale code alive.
// The React root is the only thing carried across hot reloads.
// https://bun.com/docs/bundler/hot-reloading#import-meta-hot-data
const rh = createRabbithole();
globalThis.rabbithole = rh;
import.meta.hot.dispose(() => rh.dispose());

const elem = document.getElementById("root")!;
const root = (import.meta.hot.data.root ??= createRoot(elem));

root.render(
  <StrictMode>
    <RabbitholeContext.Provider value={rh}>
      <App />
    </RabbitholeContext.Provider>
  </StrictMode>,
);
