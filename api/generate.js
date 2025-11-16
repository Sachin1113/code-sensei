require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration Constants ---
const MODEL_NAME = "gemini-2.5-flash"; // Fastest model
const MAX_RETRIES = 2; // Try up to 2 times (initial + 1 retry)

// --- Prompt Template (Forcing Minimal JSON Output) ---
const CONDENSED_PROMPT_TEMPLATE = (userPrompt) => `
Generate a single JSON object for the UI request. The object MUST contain 'html', 'css', and 'js' keys. The 'html' value must exclude DOCTYPE, html, head, or body tags. Be extremely concise.

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

    // --- API Call Execution with Retry Logic ---
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const fullPrompt = CONDENSED_PROMPT_TEMPLATE(prompt);
    let finalResult = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: fullPrompt.trim() }] }],
            });
            finalResult = result;
            break; // Success! Break the retry loop.
        } catch (error) {
            // Check for transient 503/timeout/overload errors
            if (i < MAX_RETRIES - 1 && 
                (error.message.includes('503') || error.message.includes('timeout') || error.message.includes('overloaded'))) {
                console.warn(`Transient API error detected on try ${i + 1}. Retrying in 500ms...`);
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retrying
                continue; // Continue to the next retry attempt
            } else {
                // If it's a persistent error or the last retry failed, throw it.
                throw error;
            }
        }
    }


    try {
        if (!finalResult) {
             throw new Error("API call failed after all retries.");
        }

        const response = finalResult.response;
        
        // FIX for: response.text.trim is not a function
        const rawText = response.text;

        if (typeof rawText !== 'string' || rawText.length === 0) {
             const safetyError = response.candidates?.[0]?.safetyRatings;
             throw new Error(`Model returned invalid or no text. Blocked content details: ${JSON.stringify(safetyError)}`);
        }

        const text = rawText.trim();
        let jsonText = text;

        // Extract JSON block (robustly searches for the first '{' and last '}')
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonText = text.substring(firstBrace, lastBrace + 1);
        }
        
        let parsedJson;
        try {
            parsedJson = JSON.parse(jsonText);
        } catch (e) {
             // Throws an error for the outer catch block to handle and report
             throw new Error(`Failed to parse JSON response: ${e.message}. Raw text snippet: ${jsonText.substring(0, 100)}...`);
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
        console.error('Final function processing error:', geminiError.message || geminiError);
        let errorMessage = 'Failed to generate code from Gemini API.';

        if (geminiError.message && geminiError.message.includes('10-second limit')) {
             // 504 Timeout error
            errorMessage = 'Generation request timed out (Netlify 10-second limit exceeded). Please try a shorter or simpler prompt, like "A blue button."';
        } else if (geminiError.message) {
            errorMessage += ` Details: ${geminiError.message.substring(0, 300)}.`;
        }

        // Returns a 500 status to the client
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage, fullError: geminiError.message }),
        };
    }
};
