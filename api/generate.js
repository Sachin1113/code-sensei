// api/generate.js

// Ensure dotenv is configured at the very top
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Access your API key as an environment variable
const API_KEY = process.env.GEMINI_API_KEY;

// For Netlify Functions, you need to export a function named 'handler'
// The parameters for Netlify Functions are (event, context)
exports.handler = async (event, context) => { // <--- THIS IS THE KEY CHANGE for Netlify
    // Netlify Functions receive HTTP request details in the 'event' object
    // The request body is in event.body (and might be base64 encoded)
    // The HTTP method is in event.httpMethod
    // Headers are in event.headers

    // Set CORS headers for all responses
    const headers = {
        'Access-Control-Allow-Origin': 'https://sensei-code.netlify.app', // <--- YOUR NETLIFY FRONTEND DOMAIN HERE
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json; charset=utf-8', // Good practice for JSON responses
        'X-Content-Type-Options': 'nosniff', // Security header
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', // Recommended for API responses
        'Pragma': 'no-cache',
        'Expires': '0',
    };

    // Handle CORS preflight requests (OPTIONS method)
    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS request.');
        return {
            statusCode: 200,
            headers, // Use the defined headers
            body: 'OK',
        };
    }

    // Ensure it's a POST request
    if (event.httpMethod !== 'POST') {
        console.log('Method not POST:', event.httpMethod);
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    // Parse the request body
    let prompt;
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Request body is missing.' }),
            };
        }
        // Netlify functions might base64 encode the body for certain content types
        const requestBody = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
        prompt = requestBody.prompt;
    } catch (parseError) {
        console.error('Error parsing request body:', parseError);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid JSON in request body.' }),
        };
    }

    // Log the prompt for debugging
    console.log('API Function Invoked!');
    console.log('Received Prompt:', prompt);

    if (!prompt) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Prompt is required.' }),
        };
    }

    if (!API_KEY) {
        console.error("GEMINI_API_KEY is not set in environment variables!");
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error: API Key missing.' }),
        };
    }

    const genAI = new GoogleGenerativeAI(API_KEY);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5 Flash for speed
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

        const htmlMatch = text.match(/HTML_START\n([\s\S]*?)\nHTML_END/);
        const cssMatch = text.match(/CSS_START\n([\s\S]*?)\nCSS_END/);
        const jsMatch = text.match(/JS_START\n([\s\S]*?)\nJS_END/);

        const html = htmlMatch ? htmlMatch[1].trim() : '';
        const css = cssMatch ? cssMatch[1].trim() : '';
        const js = jsMatch ? jsMatch[1].trim() : '';

        console.log("Full Gemini Response Text:\n", text);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ html, css, js,text}),
        };

    } catch (geminiError) {
        console.error('Error calling Gemini API:', geminiError.message || geminiError);
        let errorMessage = 'Failed to generate code from Gemini API.';
        if (geminiError.response && geminiError.response.status) {
            errorMessage += ` Status: ${geminiError.response.status}.`;
        }
        if (geminiError.message) {
            errorMessage += ` Details: ${geminiError.message}.`;
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage }),
        };
    }
};