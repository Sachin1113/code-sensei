require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration Constants ---
const MODEL_NAME = "gemini-2.5-flash"; // Fastest model
const API_KEY = process.env.GEMINI_API_KEY;

// --- Prompt Template (Forcing Minimal JSON Output) ---
const CONDENSED_PROMPT_TEMPLATE = (userPrompt) => `
Generate a single JSON object for the UI request. The object MUST contain 'html', 'css', and 'js' keys. The 'html' value must exclude DOCTYPE, html, head, or body tags. Be concise.

User Request: ${userPrompt}

JSON:
`;

// --- Netlify Handler Function ---
exports.handler = async (event) => {
    // Standard CORS headers
    const headers = {
        'Access-Control-Allow-Origin': 'https://sensei-code.netlify.app',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
    };

    if (event.httpMethod === 'OPTIONS') { return { statusCode: 200, headers, body: 'OK' }; }
    if (event.httpMethod !== 'POST') { return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) }; }

    let prompt;
    try {
        if (!event.body) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body is missing.' }) }; }
        const bodyString = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
        const requestBody = JSON.parse(bodyString);
        prompt = requestBody.prompt;
    } catch (parseError) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON in request body.' }) };
    }

    const API_KEY = process.env.GEMINI_API_KEY;

    if (!prompt) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt is required.' }) }; }
    if (!API_KEY) { 
        console.error("CRITICAL: API Key is missing.");
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error: API Key missing.' }) }; 
    }

    // --- API Call Execution ---
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        // CRITICAL: Generate the full, single-string prompt for maximum speed.
        const fullPrompt = CONDENSED_PROMPT_TEMPLATE(prompt);

        const apiCall = () => model.generateContent({
            // Minimal payload for maximum speed
            contents: [{ role: "user", parts: [{ text: fullPrompt.trim() }] }],
        });

        // No complex retries to save precious time
        const result = await apiCall(); 

        const response = result.response;
        
        if (!response.text) {
             const safetyError = response.candidates?.[0]?.safetyRatings;
             throw new Error(`Model response was empty or blocked. Safety details: ${JSON.stringify(safetyError)}`);
        }

        const text = response.text.trim();
        let jsonText = text;

        // Attempt to find the clean JSON block starting with {
        // This is robust to cases where the model might include "JSON:" or other text
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonText = text.substring(firstBrace, lastBrace + 1);
        }
        
        let parsedJson;
        try {
            parsedJson = JSON.parse(jsonText);
        } catch (e) {
             // If parsing fails, throw an error that returns a 500 to the client.
             throw new Error(`Failed to parse JSON response: ${e.message}. Raw text: ${jsonText.substring(0, 100)}...`);
        }

        const html = parsedJson.html || '';
        const css = parsedJson.css || '';
        const js = parsedJson.js || '';

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ html, css, js, text }),
        };

    } catch (geminiError) {
        console.error('Final failure calling Gemini API:', geminiError.message || geminiError);
        let errorMessage = 'Failed to generate code from Gemini API.';

        if (geminiError.message && (geminiError.message.includes('504') || geminiError.message.includes('timeout') || geminiError.message.includes('ECONNRESET'))) {
            // This is the definitive Netlify timeout error we see in your console
            errorMessage = 'Generation request timed out (Netlify 10-second limit exceeded). Please try a shorter or simpler prompt, like "A blue button."';
        } else if (geminiError.message) {
            errorMessage += ` Details: ${geminiError.message.substring(0, 300)}.`;
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage, fullError: geminiError.message }),
        };
    }
};
