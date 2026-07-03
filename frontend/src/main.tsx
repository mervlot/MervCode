import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import 'bootstrap-icons/font/bootstrap-icons.css';
import App from "./App"
import "./index.css"
import "material-symbols";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)