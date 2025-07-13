// client/src/App.jsx
import React, { useState, useEffect } from "react";
import PromptInput from "./components/PromptInput";
import CodeDisplay from "./components/CodeDisplay";
import PreviewWindow from "./components/PreviewWindow";
import HistoryPanel from "./components/HistoryPanel";
import "./index.css"; // Tailwind CSS imports from here

const App = () => {
  const [generatedCode, setGeneratedCode] = useState({ html: '', css: '', js: '' });
  const [activeView, setActiveView] = useState("code");
  const [history, setHistory] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState(""); // To display current prompt in history

  useEffect(() => {
    // Load history from local storage on mount
    const savedHistory = localStorage.getItem('aiCodeSenseiHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    // Save history to local storage whenever it changes
    localStorage.setItem('aiCodeSenseiHistory', JSON.stringify(history));
  }, [history]);

  const handleCodeGenerated = (codeParts, prompt) => { // Now accepts html, css, js
    setGeneratedCode(codeParts);
    setCurrentPrompt(prompt); // Update current prompt display

    // Add to history if not already the last item and code was generated
    if (codeParts.html || codeParts.css || codeParts.js) {
        setHistory(prev => {
            // Prevent adding duplicate prompts if generate button is clicked multiple times for same prompt
            if (prev.length > 0 && prev[prev.length - 1].prompt === prompt) {
                return prev;
            }
            return [...prev, { prompt, code: codeParts }];
        });
    }
  };

  const handleHistoryItemClick = (item) => {
    setCurrentPrompt(item.prompt);
    setGeneratedCode(item.code);
    setActiveView("code"); // Show code when history item is clicked
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* History Panel */}
      <HistoryPanel history={history} onHistoryItemClick={handleHistoryItemClick} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-8 space-y-8 max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-center text-teal-400">
          <span role="img" aria-label="lightbulb">💡</span> Ask SenSei
        </h1>

        {/* Prompt Input */}
        <PromptInput onCodeGenerated={handleCodeGenerated} />

        {/* Output Window & Toggle Buttons */}
        <div className="flex flex-col flex-1 bg-gray-800 rounded-lg shadow-xl overflow-hidden">
          <div className="flex justify-center p-2 bg-gray-700">
            <button
              className={`px-6 py-2 rounded-l-lg font-semibold transition-colors duration-200 ${
                activeView === "code"
                  ? "bg-teal-600 text-white shadow-lg"
                  : "bg-gray-600 text-gray-300 hover:bg-gray-500"
              }`}
              onClick={() => setActiveView("code")}
            >
              Code
            </button>
            <button
              className={`px-6 py-2 rounded-r-lg font-semibold transition-colors duration-200 ${
                activeView === "preview"
                  ? "bg-teal-600 text-white shadow-lg"
                  : "bg-gray-600 text-gray-300 hover:bg-gray-500"
              }`}
              onClick={() => setActiveView("preview")}
            >
              Preview
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeView === "code" ? (
              <CodeDisplay code={generatedCode} />
            ) : (
              <PreviewWindow code={generatedCode.html} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;