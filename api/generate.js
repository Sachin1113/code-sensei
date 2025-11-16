require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Setting the preferred model
const MODEL_NAME = "gemini-2.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

// 1. Separate the detailed instructions into a SYSTEM_INSTRUCTION constant.
// This block contains both the instruction persona and the fixed output template structure.
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

    // Handle CORS preflight (OPTIONS)
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: 'OK' };
    }

    // Ensure POST method
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

    // --- Core Fix: Using Configuration Object for Generation ---
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        // Split the SYSTEM_INSTRUCTION into two parts:
        // 1. The instruction block (everything before "User Request:")
        // 2. The output template (everything after "User Request:")
        const [systemInstructionText, outputTemplate] = SYSTEM_INSTRUCTION.split("User Request:");

        // Construct the full user query by combining the user's prompt and the template structure.
        const fullUserQuery = `
            ${prompt}
            ---
            User Request: ${outputTemplate}
        `;

        const result = await model.generateContent({
            // Pass the detailed instructions as a separate system role
            systemInstruction: { parts: [{ text: systemInstructionText.trim() }] },
            // Pass the user's content (which includes the prompt and the template)
            contents: [{ role: "user", parts: [{ text: fullUserQuery.trim() }] }],
        });

        const response = result.response;
        
        // Basic check for content safety or empty response
        if (!response.text) {
             const safetyError = response.candidates?.[0]?.safetyRatings;
             throw new Error(`Model response was empty or blocked. Safety details: ${JSON.stringify(safetyError)}`);
        }

        const text = response.text.trim();

        // Regex to safely extract content between markers
        // Note: [\s\S]*? is used to match any character including newlines (non-greedy)
        const htmlMatch = text.match(/HTML_START\n([\s\S]*?)\nHTML_END/);
        const cssMatch = text.match(/CSS_START\n([\s\S]*?)\nCSS_END/);
        const jsMatch = text.match(/JS_START\n([\s\S]*?)\nJS_END/);

        // Extract content, ensuring it's trimmed and defaults to an empty string if not found
        const html = htmlMatch && htmlMatch[1] ? htmlMatch[1].trim() : '';
        const css = cssMatch && cssMatch[1] ? cssMatch[1].trim() : '';
        const js = jsMatch && jsMatch[1] ? jsMatch[1].trim() : '';

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ html, css, js, text }), // Include 'text' for logging/debugging
        };

    } catch (geminiError) {
        console.error('Error calling Gemini API:', geminiError.message || geminiError);
        let errorMessage = 'Failed to generate code from Gemini API.';

        if (geminiError.message) {
            errorMessage += ` Details: ${geminiError.message.substring(0, 300)}.`;
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage, fullError: geminiError.message }),
        };
    }
};
