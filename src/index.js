import React from "react";
import "./config.js";
import { createRoot } from "react-dom/client";
import { App } from "./app.jsx";
// 清除现有的 HTML 内容

// 渲染你的 React 组件
const root = createRoot(document.getElementById("app"));
root.render(<App></App>);
