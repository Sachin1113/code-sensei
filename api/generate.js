require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration Constants ---
const MODEL_NAME = "gemini-2.5-flash"; // Fastest model
const API_KEY = process.env.GEMINI_API_KEY;
const MAX_RETRIES = 1; 

// --- System Instruction (Clean and concise for speed) ---
const SYSTEM_INSTRUCTION = `
You are an expert frontend developer specializing in HTML, CSS, and vanilla JS (ES6+). Your task is to generate **complete, standalone** code for the user's request. You MUST return a single JSON object with 'html', 'css', and 'js' fields. 
IMPORTANT: The 'html' field must NOT include <!DOCTYPE html>, <html>, <head>, or <body> tags.
`;

// --- JSON Schema for Structured Output (MANDATORY) ---
const RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
        html: { type: "STRING", description: "The complete HTML snippet for the requested component, without DOCTYPE, html, head, or body tags." },
        css: { type: "STRING", description: "The standard CSS styles or a comment indicating Tailwind CSS was used (e.g., /* Tailwind used */)." },
        js: { type: "STRING", description: "The vanilla JavaScript (ES6+) required for component interactivity. Use inline comments for explanation." },
    },
    required: ["html", "css", "js"],
    propertyOrdering: ["html", "css", "js"]
};

// --- Retry Utility Function (Simplified) ---
async function fetchWithRetries(apiCall) {
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
    if (!API_KEY) { 
        console.error("CRITICAL: API Key is missing.");
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error: API Key missing.' }) }; 
    }

    // --- API Call Execution ---
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const apiCall = () => model.generateContent({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION.trim() }] },
            contents: [{ role: "user", parts: [{ text: prompt.trim() }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
            }
        });

        const result = await fetchWithRetries(apiCall);

        const response = result.response;
        
        if (!response.text) {
             const safetyError = response.candidates?.[0]?.safetyRatings;
             throw new Error(`Model response was empty or blocked. Safety details: ${JSON.stringify(safetyError)}`);
        }

        // CRITICAL FIX: Parse the JSON response directly
        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);

        const html = parsedJson.html || '';
        const css = parsedJson.css || '';
        const js = parsedJson.js || '';
        // Note: The 'text' field now holds the raw JSON string
        const text = jsonText; 

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ html, css, js, text }),
        };

    } catch (geminiError) {
        console.error('Final failure calling Gemini API:', geminiError.message || geminiError);
        let errorMessage = 'Failed to generate code from Gemini API.';

        if (geminiError.message && (geminiError.message.includes('504') || geminiError.message.includes('timeout') || geminiError.message.includes('ECONNRESET'))) {
            // Displaying the definitive Netlify timeout error
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
