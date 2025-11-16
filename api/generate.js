require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration Constants ---
const MODEL_NAME = "gemini-2.5-flash"; 
const API_KEY = process.env.GEMINI_API_KEY;
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000; 

// --- Retry Utility Function ---
async function fetchWithRetries(apiCall, maxRetries, initialDelay) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await apiCall();
            return result;
        } catch (error) {
            if (i === maxRetries - 1) {
                console.error(`Final attempt failed. Throwing error:`, error.message);
                throw error;
            }
            const delay = initialDelay * Math.pow(2, i);
            console.warn(`Attempt ${i + 1} failed. Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}


// --- System Instruction and Template (Minimized for speed) ---
const SYSTEM_INSTRUCTION = `
You are an expert frontend developer providing **complete, standalone** HTML, CSS, and vanilla JS (ES6+). Generate code **ONLY** within the specified markers.

**STRICT FORMAT MANDATORY:**
1. **Markers:** Use \`HTML_START\`/\`HTML_END\`, \`CSS_START\`/\`CSS_END\`, \`JS_START\`/\`JS_END\`.
2. **No External Text:** Respond with **only** the code blocks.
3. **HTML:** Do NOT include \`<!DOCTYPE html>\`, \`<html>\`, \`<head>\`, or \`<body\`> tags.
4. **CSS:** Use Tailwind classes in HTML (CSS block: \`/* Tailwind used */\`) OR provide standard CSS in the CSS block.

User Request: HTML_START
HTML_END
CSS_START
/* Your generated CSS code goes here */
CSS_END
JS_START
// Your generated JavaScript code goes here
JS_END
`;

// --- Netlify Handler Function ---
exports.handler = async (event) => {
    // --- DEBUG CHECK ---
    const isApiKeyPresent = !!API_KEY;
    console.log(`Debug Check: API Key is present: ${isApiKeyPresent}`);
    // -------------------

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

    if (!prompt) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt is required.' }) }; }
    
    if (!API_KEY) { 
        // We will log this error if the check above failed
        console.error("CRITICAL: GEMINI_API_KEY is not set in Netlify environment variables!");
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error: API Key missing. Check Netlify Environment Variables.' }) }; 
    }

    // --- API Call Execution ---
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const [systemInstructionText, outputTemplate] = SYSTEM_INSTRUCTION.split("User Request:");

        const fullUserQuery = `${prompt}\n---\nUser Request: ${outputTemplate}`;
        
        const apiCall = () => model.generateContent({
            systemInstruction: { parts: [{ text: systemInstructionText.trim() }] },
            contents: [{ role: "user", parts: [{ text: fullUserQuery.trim() }] }],
        });

        const result = await fetchWithRetries(apiCall, MAX_RETRIES, INITIAL_DELAY_MS);

        const response = result.response;
        
        if (!response.text) {
             const safetyError = response.candidates?.[0]?.safetyRatings;
             throw new Error(`Model response was empty or blocked. Safety details: ${JSON.stringify(safetyError)}`);
        }

        const text = response.text.trim();

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

        if (geminiError.message) {
            errorMessage += ` Details: ${geminiError.message.substring(0, 300)}.`;
        }
        
        if (geminiError.message && (geminiError.message.includes('504') || geminiError.message.includes('timeout'))) {
            errorMessage = 'Generation request timed out (Netlify 10-second limit exceeded). Try a simpler prompt.';
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage, fullError: geminiError.message }),
        };
    }
};
