// client/src/components/HistoryPanel.jsx
import React from "react";

const HistoryPanel = ({ history, onHistoryItemClick }) => {
  return (
    <div className="w-70 bg-gray-800 p-6 flex flex-col shadow-lg overflow-y-auto">
      <h2 className="text-2xl font-bold text-teal-400 mb-6">History</h2>
      {history.length === 0 ? (
        <p className="text-gray-400 text-sm">No history yet.</p>
      ) : (
        <ul className="space-y-3">
          {history.map((item, index) => (
            <li key={index} className="flex items-center space-x-2">
              <span className="text-teal-500 text-lg">›</span>
              <button
                onClick={() => onHistoryItemClick(item)}
                className="text-gray-300 hover:text-white hover:underline cursor-pointer text-left w-full truncate"
                title={item.prompt} // Show full prompt on hover
              >
                {item.prompt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default HistoryPanel;