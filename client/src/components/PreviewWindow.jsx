// client/src/components/PreviewWindow.jsx
import React from "react";

const PreviewWindow = ({ code }) => {
  // Create a full HTML document for the iframe
  const iframeContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Preview</title>
      <style>
        body { margin: 0; padding: 0; }
        /* Add any default preview styles here, e.g., for responsiveness */
      </style>
    </head>
    <body>
      ${code}
    </body>
    </html>
  `;

  return (
    <div className="w-full h-full bg-white rounded-b-lg overflow-hidden flex items-center justify-center">
      {code ? (
        <iframe
          title="Code Preview"
          srcDoc={iframeContent}
          sandbox="allow-scripts allow-same-origin" // Allows JS execution safely
          className="w-full h-full border-0"
        ></iframe>
      ) : (
        <p className="text-gray-400 text-center">
          Enter a prompt to see the generated code preview.
        </p>
      )}
    </div>
  );
};

export default PreviewWindow;