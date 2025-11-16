require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration Constants ---
const MODEL_NAME = "gemini-2.5-flash"; // Fastest model
const API_KEY = process.env.GEMINI_API_KEY;
const MAX_RETRIES = 1; // Removing retries to save time
const INITIAL_DELAY_MS = 500; 

// --- System Instruction and Template (Condensed for speed) ---
const CONDENSED_PROMPT_TEMPLATE = (userPrompt) => `
You are an expert frontend developer providing **complete, standalone** HTML, CSS, and vanilla JS (ES6+). Your output MUST be in three sections, strictly delimited by markers.

**STRICT FORMAT MANDATORY:**
1. Do NOT include any text, conversation, or explanation outside of these markers.
2. HTML must NOT include \`<!DOCTYPE html>\`, \`<html>\`, \`<head>\`, or \`<body\`> tags.

**User Request:** ${userPrompt}

---

HTML_START
<!-- Your generated HTML here -->
HTML_END

CSS_START
/* Your generated CSS here */
CSS_END

JS_START
// Your generated JavaScript here
JS_END
`;

// --- Retry Utility Function (Simplified) ---
async function fetchWithRetries(apiCall) {
    // Only one attempt for speed
    try {
        const result = await apiCall();
        return result;
    } catch (error) {
        throw error;
    }
}


// --- Netlify Handler Function ---
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://sensei-code.netlify.app',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
    if (!API_KEY) { return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error: API Key missing.' }) }; }

    // --- API Call Execution ---
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        // CRITICAL: Generate the full, single-string prompt for maximum speed.
        const fullPrompt = CONDENSED_PROMPT_TEMPLATE(prompt);

        const apiCall = () => model.generateContent({
            // Passing all instructions and query as one block to minimize processing time
            contents: [{ role: "user", parts: [{ text: fullPrompt.trim() }] }],
        });

        // Execute the call without retries (to save time)
        const result = await fetchWithRetries(apiCall);

        const response = result.response;
        
        if (!response.text) {
             const safetyError = response.candidates?.[0]?.safetyRatings;
             throw new Error(`Model response was empty or blocked. Safety details: ${JSON.stringify(safetyError)}`);
        }

        const text = response.text.trim();

        // Regex remains the same to parse the output
        const htmlMatch = text.match(/HTML_START\n([\s\S]*?)\nHTML_END/);
        const cssMatch = text.match(/CSS_START\n([\s\S]*?)\nCSS_END/);
        const jsMatch = text.match(/JS_START\n([\s\S]*?)\nJS_END/);

        const html = htmlMatch && htmlMatch[1] ? htmlMatch[1].trim() : '';
        const css = cssMatch && cssMatch[1] ? cssMatch[1].trim() : '';
        const js = jsMatch && jsMatch[1] ? jsMatch[1].trim() : '';

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ html, css, js, text }),
        };

    } catch (geminiError) {
        console.error('Final failure calling Gemini API:', geminiError.message || geminiError);
        let errorMessage = 'Failed to generate code from Gemini API.';

        if (geminiError.message && (geminiError.message.includes('504') || geminiError.message.includes('timeout') || geminiError.message.includes('ECONNRESET'))) {
            // This is the definitive Netlify timeout
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
