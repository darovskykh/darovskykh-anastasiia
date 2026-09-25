import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installStaleChunkReload } from "./utils/staleChunkReload";
import { installAutoUpdateReload } from "./utils/autoUpdateReload";

// Self-heal a tab left open across a deploy: a failed lazy import() means the
// old chunk name is gone, so reload once to pick up the fresh build.
installStaleChunkReload();

// Proactively pick up a new deploy: poll the deployed index.html and reload on
// tab refocus when the build changed (so client-side-only navigation no longer
// leaves the tab on a stale bundle). Skips the live-simulation route.
installAutoUpdateReload();

// Загружаем dev helpers в режиме разработки. RETAIL SCANNER TEST
if (import.meta.env.DEV) {
  import('./utils/devHelpers');
}

const render = () => createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.VITE_MOCK_API === 'true') {
  import('./mock/installMockApi').then(({ installMockApi }) => {
    installMockApi();
    render();
  });
} else {
  render();
}
