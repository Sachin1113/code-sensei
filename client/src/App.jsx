// client/src/App.jsx

import React, { useState, useEffect, Suspense, lazy } from 'react';
import PromptInput from './components/PromptInput';
import PreviewWindow from './components/PreviewWindow';
import HistoryPanel from './components/HistoryPanel';

const CodeDisplay = lazy(() => import('./components/CodeDisplay'));

function App() {
  const [generatedCode, setGeneratedCode] = useState({ html: '', css: '', js: '', fullText: '' });
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [activeView, setActiveView] = useState('preview');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('sensei_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load history from localStorage:", e);
      setHistory([]);
    }
  }, []);

  const handleCodeGenerated = (codeData, prompt) => {
    const { html, css, js, fullText } = codeData;
    setGeneratedCode({ html, css, js, fullText });
    setCurrentPrompt(prompt);
    setActiveView('preview');

    const newHistoryItem = { prompt, code: { html, css, js, fullText } };
    setHistory(prevHistory => {
      const updatedHistory = [newHistoryItem, ...prevHistory.slice(0, 9)];
      try {
        localStorage.setItem('sensei_history', JSON.stringify(updatedHistory));
      } catch (e) {
        console.error("Failed to save history to localStorage:", e);
      }
      return updatedHistory;
    });
  };

  const handleHistoryItemClick = (item) => {
    setGeneratedCode(item.code);
    setCurrentPrompt(item.prompt);
    setActiveView('preview');
  };

  const clearAllHistory = () => {
    if (window.confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      setHistory([]);
      localStorage.removeItem('sensei_history');
      setGeneratedCode({ html: '', css: '', js: '', fullText: '' });
      setCurrentPrompt('');
      setActiveView('preview');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-dark text-gray-100 font-sans">
      {/* Header Section */}
      <header className="flex-shrink-0 p-4 bg-[#111A23] shadow-lg flex items-center justify-between"> {/* Updated bg-gray-800 */}
        <h1 className="text-2xl font-bold text-[#20C29F] flex items-center"> {/* Updated text-teal-400 */}
          <span role="img" aria-label="lightbulb" className="mr-2 text-yellow-400">💡</span> Ask SenSei
        </h1>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden p-4">
        {/* History Panel (Left Sidebar) */}
        <div className="w-1/4 flex-shrink-0 bg-[#111A23] p-4 rounded-lg shadow-md mr-4 overflow-y-auto"> {/* Updated bg-gray-800 */}
          <HistoryPanel history={history} onHistoryItemClick={handleHistoryItemClick} />
          {history.length > 0 && (
            <button
              onClick={clearAllHistory}
              className="mt-4 w-full py-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-semibold transition-colors duration-200"
            >
              Clear All History
            </button>
          )}
        </div>

        {/* Central Content Area (Prompt Input, Code/Preview Tabs, and Display) */}
        <div className="flex-1 flex flex-col bg-[#111A23] p-4 rounded-lg shadow-xl"> {/* Updated bg-gray-800 */}
          {/* Prompt Input Section */}
          <div className="flex-shrink-0 mb-4">
            <PromptInput onCodeGenerated={handleCodeGenerated} />
          </div>

          {/* Code and Preview Buttons */}
          <div className="flex flex-shrink-0 space-x-2 mb-4">
            <button
              onClick={() => setActiveView('code')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
                activeView === 'code' ? 'bg-[#20C29F] text-white shadow-md' : 'bg-[#212E3B] text-[#E0E7EB] hover:bg-[#2C3A4B]' // Updated colors
              }`}
            >
              Code
            </button>
            <button
              onClick={() => setActiveView('preview')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
                activeView === 'preview' ? 'bg-[#20C29F] text-white shadow-md' : 'bg-[#212E3B] text-[#E0E7EB] hover:bg-[#2C3A4B]' // Updated colors
              }`}
            >
              Preview
            </button>
          </div>

          {/* Conditional Rendering of CodeDisplay or PreviewWindow */}
          <div className="flex-1 border border-[#2C3A4B] rounded-lg overflow-hidden relative"> {/* Updated border-gray-700 */}
            <Suspense fallback={
              <div className="flex justify-center items-center h-full text-gray-400 text-xl">
                Loading Content...
              </div>
            }>
              <div style={{ display: activeView === 'preview' ? 'block' : 'none', height: '100%', width: '100%' }}>
                <PreviewWindow code={generatedCode} />
              </div>

              <div style={{ display: activeView === 'code' ? 'block' : 'none', height: '100%', width: '100%' }}>
                <CodeDisplay code={generatedCode} />
              </div>
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;