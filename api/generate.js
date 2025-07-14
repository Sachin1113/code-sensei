// api/generate.js  now changed(This file was previously server/index.js)
require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// Configure CORS for Vercel deployment
app.use(cors({
  origin: [
    'https://code-sensei-git-main-sachindra-uniyals-projects.vercel.app',
    'https://code-sensei-h4hpzybb3-sachindra-uniyals-projects.vercel.app',
    'http://localhost:5173',
    'https://code-sensei-theta.vercel.app' // Add your Vercel deployment URL here
  ],
  methods: ['GET', 'POST', 'OPTIONS'], // Allow OPTIONS for CORS preflight requests
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json()); // To parse JSON request bodies

// Initialize Gemini API
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.error("GEMINI_API_KEY is not configured in Vercel environment variables.");
}
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null; // Initialize only if key exists

// Route for code generation - this will be exposed at /api/generate
app.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  if (!geminiApiKey || !genAI) {
    return res.status(500).json({ error: 'Server API key not configured. Please set GEMINI_API_KEY environment variable.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5 Flash for speed

    // --- UPDATED AND MORE ROBUST GEMINI PROMPT FOR FRONTEND FOCUS ---
    const geminiPrompt = `
      You are an expert frontend web developer assistant specializing in creating modern, visually appealing, and highly responsive user interfaces using HTML, CSS, and vanilla JavaScript. Your goal is to provide **complete, standalone frontend code** for single web pages or specific UI components.

      **Strict Instructions for Code Generation:**
      1.  **Format:** You MUST provide the code strictly within the following markers: \`HTML_START\`/\`HTML_END\`, \`CSS_START\`/\`CSS_END\`, and \`JS_START\`/\`JS_END\`.
          * Do NOT include any markdown language identifiers (e.g., \`\`\`html) *inside* these blocks.
          * Do NOT include any conversational text, explanations, or comments *outside* these specific marker blocks.
      2.  **HTML Structure:**
          * Generate the **full HTML structure** for the requested component or a simple, single web page layout.
          * **Crucially, do NOT include \`<!DOCTYPE html>\`, \`<html>\`, \`<head>\`, or \`<body\`> tags in the HTML section.** This HTML snippet will be embedded directly into the \`<body>\` of an iframe.
          * Ensure logical and semantic HTML.
      3.  **CSS Styling:**
          * **Prioritize Tailwind CSS:** If the user's prompt explicitly mentions "Tailwind CSS" or implies modern utility-first styling (e.g., "modern UI", "clean design"), generate HTML with **Tailwind utility classes directly embedded in the HTML elements**. In this case, the \`CSS_START\`/\`CSS_END\` block should contain **only empty comments** (e.g., \`/* Tailwind CSS used */\`).
          * **Standard CSS Fallback:** If the prompt does *not* mention Tailwind or explicitly requests "custom CSS" or "SCSS", provide well-structured, standard CSS in the \`CSS_START\`/\`CSS_END\` block.
          * Ensure the design is visually appealing, modern, and responsive for various screen sizes (using media queries if standard CSS is generated).
      4.  **JavaScript Functionality:**
          * Provide clear, concise, and functional **vanilla JavaScript (ES6+)** for any requested interactivity.
          * Do NOT use external frameworks like React, Vue, or Angular unless the prompt specifically asks for a framework *and* you are configured to handle it (which is currently out of scope).
          * Ensure event listeners are correctly attached to elements that exist in the generated HTML.
          * If no JavaScript is required, provide an empty \`JS_START\`/\`JS_END\` block (e.g., \`// No JavaScript needed\`).
      5.  **Empty Sections:** If a section (HTML, CSS, or JS) is genuinely not needed, provide an empty block with a comment indicating so (e.g., \`HTML_START\n\nHTML_END\`). **However, for most requests, HTML will be present.**
      6.  **Focus on Frontend:** Understand that you are building *only* the frontend (HTML, CSS, JS). Do NOT mention backend technologies (like Node.js, Express, MongoDB, databases, APIs) or full-stack application structure. If the user asks for a "MERN stack app", interpret it as a request for a **visually appealing frontend prototype** that *could be part* of such an app, and explicitly state that in a comment within the JS block if necessary, but keep the output limited to frontend code.

      **User Request:** "${prompt}"

      ---

      HTML_START
      HTML_END

      CSS_START
      /* Your generated CSS code goes here */
      CSS_END

      JS_START
      // Your generated JavaScript code goes here
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

    console.log("Full Gemini Response Text:\n", text);

    res.json({ html, css, js, fullText: text }); // Send structured response
  } catch (error) {
    console.error('Error calling Gemini API:', error.response ? error.response.data : error.message);
    let errorMessage = 'Failed to generate code from Gemini API.';
    if (error.response && error.response.data && error.response.data.message) {
      errorMessage += ` Details: ${error.response.data.message}`;
    } else if (error.message) {
      errorMessage += ` Details: ${error.message}`;
    }
    res.status(500).json({ error: errorMessage, details: error.message });
  }
});

// Vercel serverless functions export the app instance.
module.exports = app;
