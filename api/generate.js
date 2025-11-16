require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration Constants ---
const MODEL_NAME = "gemini-2.5-flash"; // Fastest model
const MAX_RETRIES = 2; // Try up to 2 times (initial + 1 retry)

// --- JSON Schema for Guaranteed Output Format ---
const responseSchema = {
    type: "OBJECT",
    properties: {
        html: { type: "STRING", description: "The HTML structure, excluding <html>, <head>, and <body> tags." },
        css: { type: "STRING", description: "The CSS styles to be included in a <style> block." },
        js: { type: "STRING", description: "The JavaScript code to be included in a <script> block." }
    },
    required: ["html", "css", "js"],
    propertyOrdering: ["html", "css", "js"]
};

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
    let finalResult = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt.trim() }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
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
        
        // **CRITICAL: The response.text here MUST be pure JSON because of the schema**
        const jsonText = response.text;

        if (typeof jsonText !== 'string' || jsonText.length === 0) {
             const safetyRatings = response.candidates?.[0]?.safetyRatings;
             const safetyDetails = safetyRatings ? JSON.stringify(safetyRatings) : 'No content was generated.';
             throw new Error(`Model returned invalid or no text. Content failure reason: ${safetyDetails}`);
        }
        
        let parsedJson;
        try {
            // Attempt to parse the pure JSON string
            parsedJson = JSON.parse(jsonText.trim());
        } catch (e) {
             // Throws an error for the outer catch block to handle and report
             throw new Error(`Failed to parse final JSON object from schema: ${e.message}. Snippet: ${jsonText.substring(0, 100)}...`);
        }

        // Final check on structure based on the schema
        if (typeof parsedJson.html !== 'string' || typeof parsedJson.css !== 'string' || typeof parsedJson.js !== 'string') {
             throw new Error('Parsed JSON object is missing required keys (html, css, or js) despite schema.');
        }

        const html = parsedJson.html;
        const css = parsedJson.css;
        const js = parsedJson.js;
        const fullText = jsonText; // Store the raw JSON for reference

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ html, css, js, fullText }),
        };

    } catch (finalError) {
        console.error('Final function processing error:', finalError.message || finalError);
        let errorMessage = 'Failed to generate code from Gemini API.';

        if (finalError.message && finalError.message.includes('10-second limit')) {
             // 504 Timeout error
            errorMessage = 'Generation request timed out (Netlify 10-second limit exceeded). Please try a shorter or simpler prompt, like "A blue button."';
        } else if (finalError.message) {
            errorMessage += ` Details: ${finalError.message.substring(0, 300)}.`;
        }

        // Returns a 500 status to the client
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage, fullError: finalError.message }),
        };
    }
};
