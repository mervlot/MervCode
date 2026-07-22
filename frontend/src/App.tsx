import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.js";
import { ThemeProvider } from "./contexts/ThemeContext";
import "bootstrap-icons/font/bootstrap-icons.css";

function App() {
  return (


    
    <ThemeProvider>
      <Routes>
        <Route path='/' element={<Home />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
