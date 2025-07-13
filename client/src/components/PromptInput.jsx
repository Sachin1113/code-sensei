// client/src/components/PromptInput.jsx
import React, { useState } from "react";
import axios from "axios";

const PromptInput = ({ onCodeGenerated }) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions] = useState([
    "build a mern stack app",
    "build a calculator",
    "build a tic tac toe game",
    "create a responsive navigation bar with Tailwind CSS",
    "generate a simple HTML form with validation in JS",
  ]);

  const handleGenerate = async () => {
    setError(""); // Clear previous errors
    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }
    try {
      setLoading(true);
      // Use relative path for deployment
      const response = await axios.post("/generate", { prompt });
      // Pass structured code parts and the original prompt
      onCodeGenerated(response.data, prompt);
    } catch (error) {
      console.error("Error generating code:", error);
      setError(error.response?.data?.error || "Failed to generate code. Please try again.");
      onCodeGenerated({ html: "// Error generating code.", css: "", js: "" }, prompt);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setPrompt(suggestion);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="ex: build a calculator..."
          className="flex-1 p-3 rounded-lg bg-gray-700 text-gray-100 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          disabled={loading}
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors duration-200 ${
            loading ? "bg-gray-600 text-gray-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700 text-white shadow-lg"
          }`}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex flex-wrap gap-2 text-sm text-gray-300">
        <span className="font-medium">Suggestions:</span>
        {suggestions.map((sugg, index) => (
          <button
            key={index}
            onClick={() => handleSuggestionClick(sugg)}
            className="px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
          >
            {sugg}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PromptInput;