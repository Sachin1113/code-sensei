// client/src/components/CodeDisplay.jsx
import React, { useState, useEffect } from "react";
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs'; // Dark theme
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';   // Light theme
import html from 'react-syntax-highlighter/dist/esm/languages/hljs/xml'; // HTML is xml
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';

SyntaxHighlighter.registerLanguage('html', html);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('javascript', javascript);

const CodeDisplay = ({ code }) => {
  const [activeTab, setActiveTab] = useState("html");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveTab("html"); // Reset to HTML when new code is generated
  }, [code]);

  const getCodeContent = () => {
    switch (activeTab) {
      case "html": return code.html;
      case "css": return code.css;
      case "js": return code.js;
      default: return "";
    }
  };

  const getLanguage = () => {
    switch (activeTab) {
      case "html": return "html";
      case "css": return "css";
      case "js": return "javascript";
      default: return "plaintext";
    }
  };

  const handleCopyCode = () => {
    const codeToCopy = getCodeContent();
    navigator.clipboard.writeText(codeToCopy)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => console.error('Failed to copy text: ', err));
  };

  const displayCode = getCodeContent();

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-3 bg-gray-700 border-b border-gray-600">
        <div className="flex space-x-2">
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeTab === "html" ? "bg-blue-600 text-white" : "bg-gray-600 hover:bg-gray-500 text-gray-300"
            }`}
            onClick={() => setActiveTab("html")}
          >
            HTML
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeTab === "css" ? "bg-blue-600 text-white" : "bg-gray-600 hover:bg-gray-500 text-gray-300"
            }`}
            onClick={() => setActiveTab("css")}
          >
            CSS
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeTab === "js" ? "bg-blue-600 text-white" : "bg-gray-600 hover:bg-gray-500 text-gray-300"
            }`}
            onClick={() => setActiveTab("js")}
          >
            JS
          </button>
        </div>
        <button
          onClick={handleCopyCode}
          className="px-4 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors duration-200"
        >
          {copied ? "Copied!" : "Copy Code"}
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-800 rounded-b-lg p-0">
        {displayCode ? (
          <SyntaxHighlighter
            language={getLanguage()}
            style={vs2015} // Using dark theme for consistency
            showLineNumbers={true}
            className="h-full w-full p-4 text-sm"
          >
            {displayCode}
          </SyntaxHighlighter>
        ) : (
          <p className="p-4 text-center text-gray-400">
            No code generated yet or this section is empty.
          </p>
        )}
      </div>
    </div>
  );
};

export default CodeDisplay;