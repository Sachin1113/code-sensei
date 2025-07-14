// client/src/components/PromptInput.jsx
import React, { useState } from 'react';
import axios from 'axios';

const PromptInput = ({ onCodeGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePromptChange = (e) => {
    setPrompt(e.target.value);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/generate', { prompt });
      const { html, css, js, fullText } = response.data;

      onCodeGenerated({ html, css, js, fullText }, prompt);
      setPrompt('');

    } catch (err) {
      console.error('Error generating code:', err);
      setError(err.response?.data?.error || 'Failed to generate code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <textarea
        className="w-full p-3 bg-[#0A141F] border border-[#2C3A4B] rounded-md focus:outline-none focus:ring-2 focus:ring-[#20C29F] text-[#E0E7EB] resize-none h-20" // Updated colors
        placeholder="Describe the UI you want to generate..."
        value={prompt}
        onChange={handlePromptChange}
      ></textarea>

      {error && <p className="text-red-500 mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        className={`w-full py-3 rounded-md font-bold text-lg transition-colors duration-300
          ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#20C29F] hover:bg-[#1A9F82]'}`} // Updated colors
        disabled={loading}
      >
        {loading ? 'Generating...' : 'Generate Code'}
      </button>
    </>
  );
};

export default PromptInput;