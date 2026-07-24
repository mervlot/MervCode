import { useState, useEffect } from "react";
import {
  InstallTools,
  CheckLanguageTools,
} from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";

interface ToolchainPromptProps {
  language: string;
  onResolved: () => void;
  onDismiss: () => void;
}

interface ToolchainState {
  missingType: "language" | "tools" | null;
  installCommand?: string;
  missingTools?: string[];
}

export default function ToolchainPrompt({
  language,
  onResolved,
  onDismiss,
}: ToolchainPromptProps) {
  const [state, setState] = useState<ToolchainState>({ missingType: null });
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    CheckLanguageTools(language)
      .then((status) => {
        if (!status.languageInstalled) {
          setState({
            missingType: "language",
            installCommand: status.installCommand,
          });
        } else if (!status.toolsInstalled) {
          setState({
            missingType: "tools",
            missingTools: status.missingTools,
          });
        } else {
          onResolved();
        }
      })
      .catch(() => {
        setState({ missingType: "language" });
      });
  }, [language]);

  useEffect(() => {
    const unsub = EventsOn(
      "toolchain:installProgress",
      (data: { tool: string; status: string; message: string }) => {
        setProgress(data.message);
      },
    );
    return () => {
      unsub();
    };
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    setError("");

    try {
      await InstallTools(language);
      onResolved();
    } catch (err: any) {
      setError(err.message || "Installation failed");
    } finally {
      setInstalling(false);
    }
  };

  if (!state.missingType) return null;

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-[#1e1e1e] border border-[#3e3e42] rounded-lg p-6 max-w-md w-full mx-4'>
        <h3 className='text-xl font-semibold mb-4 text-white'>
          {state.missingType === "language"
            ? `${language} Runtime Required`
            : "Install Missing Tools"}
        </h3>

        {state.missingType === "language" ? (
          <div className='space-y-3'>
            <p className='text-gray-300'>
              To work with {language} files, you need to install the {language}{" "}
              runtime first.
            </p>
            <div className='bg-[#2d2d30] p-3 rounded text-sm'>
              <p className='text-gray-400 mb-1'>Install command:</p>
              <code className='text-green-400 break-all'>
                {state.installCommand}
              </code>
            </div>
            <p className='text-sm text-gray-400'>
              Install {language}, restart MervCode, then try again.
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            <p className='text-gray-300'>
              The following tools are required for {language} support:
            </p>
            <ul className='bg-[#2d2d30] p-3 rounded space-y-1'>
              {state.missingTools?.map((tool) => (
                <li key={tool} className='text-yellow-400'>
                  • {tool}
                </li>
              ))}
            </ul>
            <p className='text-sm text-gray-400'>
              MervCode can install these tools automatically.
            </p>
          </div>
        )}

        {progress && (
          <div className='mt-3 p-2 bg-blue-900/30 border border-blue-700 rounded text-sm text-blue-300'>
            {progress}
          </div>
        )}

        {error && (
          <div className='mt-3 p-2 bg-red-900/30 border border-red-700 rounded text-sm text-red-300'>
            {error}
          </div>
        )}

        <div className='flex gap-3 mt-6'>
          {state.missingType === "tools" && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className='flex-1 bg-[#0e639c] hover:bg-[#1177bb] disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition'
            >
              {installing ? "Installing..." : "Install Tools"}
            </button>
          )}
          <button
            onClick={onDismiss}
            disabled={installing}
            className='flex-1 bg-[#3e3e42] hover:bg-[#4e4e52] disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition'
          >
            {state.missingType === "language" ? "Close" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
