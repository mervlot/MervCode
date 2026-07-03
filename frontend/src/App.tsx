import { Routes, Route } from "react-router-dom";
import { useState } from "react";
import Home from "./pages/Home.js";
import Editor from "./pages/Editor.js";
import { javascript } from "@codemirror/lang-javascript";
import Header from "./components/editor/Header.js";
import "bootstrap-icons/font/bootstrap-icons.css";
function App() {
  return (
    <>
      <Routes>
        <Route path='/' element={<Home />} />
        {/* <Route path="/editor" element={<Editor language={javascript} doc={'console.log()'} />} /> */}
      </Routes>
    </>
  );
}

export default App;
