// server/index.js
require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3001; // Use Vercel's port or 3001 locally

// Configure CORS for your Vercel domains and localhost
app.use(cors({
  origin: [
    'https://ai-code-sensei-YOUR-VERCEL-SUBDOMAIN.vercel.app', // IMPORTANT: Replace with your actual Vercel deployment URL after first deploy
    'https://ai-code-sensei-sachindra-uniyals-projects.vercel.app', // Your preview URL pattern
    'http://localhost:5173' // For local frontend development
  ]
}));

app.use(express.json()); // To parse JSON request bodies

// Initialize Gemini API
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.error("GEMINI_API_KEY is not configured in .env or Vercel environment variables.");
  // Exit or handle error appropriately in production
}
const genAI = new GoogleGenerativeAI(geminiApiKey);

// Route for code generation
app.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Server API key not configured.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5 Flash for speed

    // Construct a more detailed prompt for code generation
    const geminiPrompt = `
      You are an expert web developer specializing in clean, modern, and responsive UI.
      The user wants you to generate code for a web component or a simple website.
      Provide the code in separate HTML, CSS, and JavaScript sections.
      If CSS is inline or embedded, make sure to separate it clearly.
      If JavaScript is purely functional and can be in the HTML, put it there, otherwise separate.

      User Request: "${prompt}"

      Provide the code strictly in the following format. If any section is empty, provide an empty string for it.
      Do NOT include any additional text, explanations, or markdown outside of this structure.

      HTML_START
      HTML_END

      CSS_START
      /* Your CSS code here */
      CSS_END

      JS_START
      // Your JavaScript code here
      JS_END
    `;

    const result = await model.generateContent(geminiPrompt);
    const response = await result.response;
    const text = response.text();

    // Parse the generated text into HTML, CSS, JS sections
    const htmlMatch = text.match(/HTML_START\n([\s\S]*?)\nHTML_END/);
    const cssMatch = text.match(/CSS_START\n([\s\S]*?)\nCSS_END/);
    const jsMatch = text.match(/JS_START\n([\s\S]*?)\nJS_END/);

    const html = htmlMatch ? htmlMatch[1].trim() : '';
    const css = cssMatch ? cssMatch[1].trim() : '';
    const js = jsMatch ? jsMatch[1].trim() : '';

    res.json({ html, css, js, fullText: text }); // Send structured response
  } catch (error) {
    console.error('Error calling Gemini API:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate code from Gemini API.', details: error.message });
  }
});

// Simple root endpoint for Vercel function detection (optional but good)
app.get('/', (req, res) => {
  res.send('SenSei Backend is running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});