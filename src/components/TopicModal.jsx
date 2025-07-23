// src/components/TopicModal.jsx
import { useState, useEffect } from 'react';
// We can reuse the same styles from the API Key Modal!
import '../styles/ApiKeyModal.css'; 

function TopicModal({ onSave, onClose, currentTopic }) {
  const [topicText, setTopicText] = useState('');

  // When the modal opens, pre-fill the text area with the current topic.
  useEffect(() => {
    setTopicText(currentTopic);
  }, [currentTopic]);

  const handleSave = () => {
    onSave(topicText);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Set a Topic</h2>
        <p>
          Enter words, sentences, or a paragraph to guide the sentence generation.
          Leave it blank for random sentences.
        </p>
        <textarea
          value={topicText}
          onChange={(e) => setTopicText(e.target.value)}
          placeholder="e.g., technology, travel to Japan, cooking pasta..."
          rows="5"
          style={{ fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical' }}
        />
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          <button onClick={handleSave}>Save Topic</button>
        </div>
      </div>
    </div>
  );
}

export default TopicModal;