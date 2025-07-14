// client/src/components/PreviewWindow.jsx
import React, { useRef, useEffect } from 'react';

const PreviewWindow = ({ code }) => {
  const iframeRef = useRef(null);

  // DEBUG LOG 1: Log the 'code' prop as soon as the component renders or updates
  console.log('PreviewWindow: Received code prop:', code); // This should now log an object {html, css, js}

  useEffect(() => {
    // DEBUG LOG 2: Log 'code' and iframeRef.current when useEffect starts
    console.log('PreviewWindow useEffect: code prop at start:', code);
    console.log('PreviewWindow useEffect: iframeRef.current at start:', iframeRef.current);


    // We only proceed if iframe is ready AND if 'code' has actual HTML content
    if (!iframeRef.current) {
      console.warn('PreviewWindow useEffect: iframeRef.current is null. Cannot render preview yet.');
      return; // Exit if iframe is not ready
    }

    if (!code || typeof code.html !== 'string' || code.html.trim() === '') {
      console.warn('PreviewWindow useEffect: No valid HTML code to render. Code:', code);
      // Clear existing content if previous code was shown but now it's empty
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      doc.open();
      doc.write('<p style="text-align: center; color: #6b7280; margin-top: 20px;">Enter a prompt to see the generated code preview.</p>');
      doc.close();
      return;
    }

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow.document;

    // DEBUG LOG 3: Log the content just before writing to iframe
    console.log('PreviewWindow useEffect: Attempting to write to iframe. HTML length:', code.html.length);
    console.log('PreviewWindow useEffect: First 100 chars of HTML:', code.html.substring(0, 100));
    console.log('PreviewWindow useEffect: CSS length:', code.css.length);
    console.log('PreviewWindow useEffect: JS length:', code.js.length);


    // Construct the full HTML content for the iframe
    const fullHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Preview</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { margin: 0; padding: 0; }
          ${code.css}
        </style>
      </head>
      <body>
        ${code.html}
        <script>
          // Wrap generated JS in a try-catch to prevent breaking the preview
          try {
            ${code.js}
          } catch (e) {
            console.error("Error executing generated JavaScript in preview:", e);
            // Optionally, write this error to the iframe itself
            document.body.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Error in generated JavaScript: ' + e.message + '</div>';
          }
        </script>
      </body>
      </html>
    `;

    // Write the complete HTML document to the iframe
    try {
        doc.open();
        doc.write(fullHtmlContent);
        doc.close();
        console.log('PreviewWindow useEffect: Successfully wrote content to iframe.');
    } catch (e) {
        console.error('PreviewWindow useEffect: Error writing to iframe document:', e);
    }


    // Optional: Add an error listener for scripts inside the iframe
    iframe.contentWindow.onerror = (message, source, lineno, colno, error) => {
      console.error("Error detected inside preview iframe:", { message, source, lineno, colno, error });
      return true; // Prevent default browser error reporting
    };

  }, [code]); // Dependency array: re-run this effect when 'code' prop changes

  return (
    <div className="w-full h-full bg-white rounded-b-lg overflow-hidden flex items-center justify-center">
      {/* Conditionally render the iframe or the placeholder message */}
      {code && typeof code.html === 'string' && code.html.trim() !== '' ? ( // Only render iframe if HTML code actually exists
        <iframe
          ref={iframeRef} // Attach the ref to the iframe
          title="Code Preview"
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock allow-same-origin" // Expanded sandbox for full functionality
          className="w-full h-full border-0"
        ></iframe>
      ) : (
        <p className="text-gray-400 text-center p-4">
          Enter a prompt to see the generated code preview.
        </p>
      )}
    </div>
  );
};

export default PreviewWindow;