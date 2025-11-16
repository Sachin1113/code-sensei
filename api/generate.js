require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration Constants ---
const MODEL_NAME = "gemini-2.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000; // 1 second initial delay

// --- Retry Utility Function ---
// Implements exponential backoff to handle transient network errors (like 502/504)
async function fetchWithRetries(apiCall, maxRetries, initialDelay) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await apiCall();
            // Success, return result immediately
            return result;
        } catch (error) {
            // Check if it's the last attempt
            if (i === maxRetries - 1) {
                console.error(`Final attempt failed. Throwing error:`, error.message);
                throw error;
            }

            // Calculate exponential backoff delay
            const delay = initialDelay * Math.pow(2, i);
            console.warn(`Attempt ${i + 1} failed. Retrying in ${delay / 1000}s...`);

            // Wait before the next attempt
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}


// --- System Instruction and Template ---
const SYSTEM_INSTRUCTION = `
You are an expert frontend web developer assistant specializing in creating modern, visually appealing, and highly responsive user interfaces using HTML, CSS, and vanilla JavaScript (ES6+). Your goal is to provide **complete, standalone frontend code** for single web pages or specific UI components.

**STRICT INSTRUCTIONS FOR OUTPUT FORMAT (MANDATORY):**

1.  **Markers:** You MUST provide the code strictly within the following three pairs of markers: \`HTML_START\`/\`HTML_END\`, \`CSS_START\`/\`CSS_END\`, and \`JS_START\`/\`JS_END\`.
2.  **No External Text:** Do NOT include any conversational text, explanations, or comments *outside* these specific marker blocks. The response should start with \`HTML_START\` and end with \`JS_END\` (or \`HTML_END\`, whichever is last).
3.  **No Markdown Inside Markers:** Do NOT include any markdown language identifiers (e.g., \`\`\`html) *inside* the code blocks.

**CODE CONTENT GUIDELINES:**

* **HTML Structure:**
    * Generate the **full HTML structure** for the requested component or a simple, single web page layout.
    * **CRUCIAL:** Do NOT include \`<!DOCTYPE html>\`, \`<html>\`, \`<head>\`, or \`<body\`> tags in the HTML section. This snippet is embedded directly into the \`<body>\` of an existing document.
    * Ensure logical and semantic HTML.
* **Styling (CSS):**
    * **Prioritize Tailwind CSS:** If the user's prompt suggests "Tailwind CSS" (e.g., "modern UI", "clean design", "use utility classes"), generate HTML with **Tailwind utility classes directly embedded in the HTML elements**. In this case, the \`CSS_START\`/\`CSS_END\` block must be empty or contain only a comment (\`/* Tailwind CSS used */\`).
    * **Standard CSS Fallback:** If the prompt *does not* mention Tailwind, provide well-structured, standard CSS in the \`CSS_START\`/\`CSS_END\` block, ensuring it is visually appealing and responsive (using media queries as needed).
* **JavaScript (Vanilla):**
    * Provide clear, concise, and functional **vanilla JavaScript (ES6+)** for any requested interactivity.
    * If no JavaScript is required, provide an empty \`JS_START\`/\`JS_END\` block (e.g., \`// No JavaScript needed\`).
* **Empty Sections:** If a section (CSS or JS) is not needed, provide the markers with an empty or commented block (e.g., \`CSS_START\n/* No custom CSS required */\nCSS_END\`).

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
    // Standard CORS and Security Headers
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

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: 'OK' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    let prompt;
    try {
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Request body is missing.' }) };
        }
        const bodyString = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
        const requestBody = JSON.parse(bodyString);
        prompt = requestBody.prompt;
    } catch (parseError) {
        console.error('Error parsing request body:', parseError);
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON in request body.' }) };
    }

    if (!prompt) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt is required.' }) };
    }
    if (!API_KEY) {
        console.error("GEMINI_API_KEY is not set in environment variables!");
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error: API Key missing.' }) };
    }

    // --- API Call Execution ---
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const [systemInstructionText, outputTemplate] = SYSTEM_INSTRUCTION.split("User Request:");

        const fullUserQuery = `
            ${prompt}
            ---
            User Request: ${outputTemplate}
        `;
        
        // Define the API call as a function to be passed to the retry wrapper
        const apiCall = () => model.generateContent({
            systemInstruction: { parts: [{ text: systemInstructionText.trim() }] },
            contents: [{ role: "user", parts: [{ text: fullUserQuery.trim() }] }],
        });

        // Execute the call with retries
        const result = await fetchWithRetries(apiCall, MAX_RETRIES, INITIAL_DELAY_MS);

        const response = result.response;
        
        if (!response.text) {
             const safetyError = response.candidates?.[0]?.safetyRatings;
             throw new Error(`Model response was empty or blocked. Safety details: ${JSON.stringify(safetyError)}`);
        }

        const text = response.text.trim();

        // Regex extraction logic remains the same
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

        // Return 500 status for final, persistent failures
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage, fullError: geminiError.message }),
        };
    }
};
