// client/src/components/CodeDisplay.jsx

import React, { useState, useEffect, Suspense, lazy } from 'react';

// Lazy load the SyntaxHighlighter component
const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter').then(module => ({ default: module.Light || module.default }))
);

const CodeDisplay = ({ code }) => {
  const [internalCodeTab, setInternalCodeTab] = useState('html');
  const [styleModule, setStyleModule] = useState(null); // State to hold the loaded style module

  // --- CONSOLE.LOGS FOR DEBUGGING ---
  console.log("CodeDisplay - RENDER: internalCodeTab:", internalCodeTab, "styleModule:", styleModule);
  console.log("CodeDisplay - Code prop at render:", code);
  // --- END CONSOLE.LOGS ---

  // UseEffect for loading style (runs ONCE on mount)
  useEffect(() => {
    console.log("CodeDisplay - useEffect for style loading: Component MOUNTED.");
    const loadStyle = async () => {
      try {
        // Import the style directly here and set it
        const loadedStyle = await import('react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark');
        setStyleModule(loadedStyle.default);
        console.log("CodeDisplay - Style loaded successfully. styleModule is now set.");
      } catch (error) {
        console.error("CodeDisplay - Failed to load syntax highlighter style:", error);
        setStyleModule({}); // Fallback to an empty object
      }
    };
    loadStyle();

    // Cleanup function for unmount (still important for verifying no unexpected unmounts)
    return () => {
      console.log("CodeDisplay - useEffect cleanup: Component UNMOUNTED.");
    };
  }, []); // Empty dependency array means runs once on initial mount

  if (!code || (code.html === '' && code.css === '' && code.js === '')) {
    return (
      <div className="flex justify-center items-center h-full text-[#9CA3AF]"> {/* Updated text color */}
        Generate some code to see it here!
      </div>
    );
  }

  // Determine which code to display
  const displayCode = internalCodeTab === 'html' ? code.html :
                      internalCodeTab === 'css' ? code.css :
                      code.js; // Default to JS

  const language = internalCodeTab === 'html' ? 'html' :
                   internalCodeTab === 'css' ? 'css' :
                   'javascript';


  return (
    <div className="p-4 overflow-auto h-full bg-[#111A23] rounded-lg shadow-inner flex flex-col"> {/* Updated bg color */}
      <div className="flex space-x-2 mb-4 flex-shrink-0">
        <button
          onClick={() => setInternalCodeTab('html')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
            internalCodeTab === 'html' ? 'bg-[#212E3B] text-[#20C29F]' : 'bg-[#0A141F] text-[#E0E7EB] hover:bg-[#212E3B]' // Updated colors
          }`}
        >
          HTML
        </button>
        <button
          onClick={() => setInternalCodeTab('css')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
            internalCodeTab === 'css' ? 'bg-[#212E3B] text-[#20C29F]' : 'bg-[#0A141F] text-[#E0E7EB] hover:bg-[#212E3B]' // Updated colors, removed specific blue for consistency with accent
          }`}
        >
          CSS
        </button>
        <button
          onClick={() => setInternalCodeTab('js')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
            internalCodeTab === 'js' ? 'bg-[#212E3B] text-[#20C29F]' : 'bg-[#0A141F] text-[#E0E7EB] hover:bg-[#212E3B]' // Updated colors, removed specific purple for consistency with accent
          }`}
        >
          JS
        </button>
      </div>

      <div className="flex-1 overflow-auto"> {/* This div handles the main scrolling */}
        {styleModule ? ( // Only render Suspense/SyntaxHighlighter if styleModule is loaded
          <Suspense fallback={
            <div className="flex justify-center items-center h-full text-[#9CA3AF] text-lg"> {/* Updated text color */}
              Loading Syntax Highlighter...
            </div>
          }>
            <SyntaxHighlighter
              language={language}
              style={styleModule}
              showLineNumbers
              className="rounded-md"
              wrapLines={true} // Crucial: Enable line wrapping from SyntaxHighlighter
              customStyle={{
                backgroundColor: 'transparent', // Ensure background is transparent to show parent bg
                wordBreak: 'break-word', // Break words that are too long
                whiteSpace: 'pre-wrap',  // Preserve whitespace but wrap lines
                overflowX: 'hidden' // Hide horizontal scrollbar within the highlighter if it somehow appears
              }}
              lineProps={{
                style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } // For individual lines
              }}
            >
              {displayCode || (internalCodeTab === 'html' ? '// No HTML generated' : internalCodeTab === 'css' ? '/* No CSS generated */' : '// No JavaScript generated')}
            </SyntaxHighlighter>
          </Suspense>
        ) : (
          <div className="flex justify-center items-center h-full text-[#9CA3AF] text-lg"> {/* Updated text color */}
            Applying syntax highlighting...
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeDisplay;