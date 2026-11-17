import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/style.css";
import "./styles/desktop.css";
import "./styles/layout.css";
import "./styles/agent.css";
import "./styles/premium.css"; // 0.1.5: premium palette, menus, settings, typography and speed – always last
import { initBridge } from "./bridge.js";
import App from "./App.jsx";

// Last line of defence: a rendering error shows a plain message instead of a blank window.
class Guard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Frame>
        <p className="no-bridge">Възникна грешка в интерфейса на програмата. Запазените чатове не са засегнати.</p>
        <button className="b wine" onClick={() => window.location.reload()}>Зареди отново</button>
      </Frame>
    );
  }
}

function Frame({ children }) {
  return (
    <div className="shell">
      <div className="winbar"><b>Тед</b><span className="wb-sub">Имоти Надежда · Тед за Windows</span></div>
      <div className="login">{children}</div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
initBridge().then(
  (bridge) => root.render(bridge
    ? <Guard><App /></Guard>
    : <Frame><p className="no-bridge">Този екран работи само вътре в програмата „Тед за Windows“.</p></Frame>),
  () => root.render(<Frame><p className="no-bridge">Програмата не успя да стартира интерфейса.</p></Frame>),
);
