import { useEffect, useRef, useState, useCallback } from "react";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";

import "@xterm/xterm/css/xterm.css";

import {
  ResizeTerminal,
  StartTerminal,
  TerminalInput,
} from "../../../wailsjs/go/main/App";

import { EventsOn } from "../../../wailsjs/runtime/runtime";

const TerminalPanel = () => {
  const ref = useRef<HTMLDivElement>(null);

  const [height, setHeight] = useState<number>(300);
  const isDragging = useRef<boolean>(false);
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(300);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      startY.current = e.clientY;
      startHeight.current = height;

      document.body.style.userSelect = "none";
      document.body.style.cursor = "ns-resize";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return;

        const deltaY = startY.current - moveEvent.clientY;
        const newHeight = Math.max(
          100,
          Math.min(1000, startHeight.current + deltaY),
        );

        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [height],
  );

  useEffect(() => {
    if (!ref.current) return;

    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2,

      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,

      scrollback: 5000,
      smoothScrollDuration: 100,

      theme: {
        background: "#000",
        foreground: "#e4e4e7",
        cursor: "#fafafa",
        cursorAccent: "#09090b",
        selectionBackground: "#3f3f46",

        black: "#18181b",
        brightBlack: "#71717a",
        red: "#f87171",
        brightRed: "#fca5a5",
        green: "#4ade80",
        brightGreen: "#86efac",
        yellow: "#facc15",
        brightYellow: "#fde047",
        blue: "#60a5fa",
        brightBlue: "#93c5fd",
        magenta: "#c084fc",
        brightMagenta: "#d8b4fe",
        cyan: "#22d3ee",
        brightCyan: "#67e8f9",
        white: "#d4d4d8",
        brightWhite: "#fafafa",
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicodeAddon = new Unicode11Addon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicodeAddon);

    term.unicode.activeVersion = "11";

    term.open(ref.current);
    fitAddon.fit();

    const offOutput = EventsOn("terminal:output", (output) => {
      term.write(String(output));
    });

    const resizeTerminal = () => {
      fitAddon.fit();
      void ResizeTerminal(term.cols, term.rows).catch(console.error);
    };

    const resizeObserver = new ResizeObserver(resizeTerminal);
    resizeObserver.observe(ref.current);

    const inputDisposable = term.onData((data) => {
      void TerminalInput(data).catch(console.error);
    });

    void StartTerminal()
      .then(() => {
        resizeTerminal();
        term.focus();
      })
      .catch((error) => {
        term.writeln(
          `\r\n\x1b[31mFailed to start terminal: ${String(error)}\x1b[0m`,
        );
      });

    return () => {
      inputDisposable.dispose();
      resizeObserver.disconnect();
      offOutput();
      term.dispose();
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: `${height}px`,
      
        overflow: "hidden",
      
        display: "flex",
        flexDirection: "column",
      
      }}
    >
      {/* Flat Top Bar (Also serves as the drag handle) */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: "36px",
          width: "100%",
          cursor: "ns-resize",
       
          display: "flex",
          alignItems: "center",
      
         
          flexShrink: 0,
     
        }}
      >
        <span
          style={{
            color: "#a1a1aa",
            fontSize: "12px",
            fontFamily: "sans-serif",
            textTransform: "uppercase",
            letterSpacing: "1px",
            userSelect: "none",
            padding:"2px",
          }}
        >
          Terminal
        </span>
      </div>

      {/* Terminal Viewport */}
      <div
        style={{
          flex: 1,

          overflow: "hidden",
        }}
      >
        <div
          ref={ref}
          style={{
            width: "100%",
            height: "100%",
            
          }}
        />
      </div>
    </div>
  );
};

export default TerminalPanel;
