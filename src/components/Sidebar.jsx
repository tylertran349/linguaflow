// src/components/Sidebar.jsx

import React from 'react';
import '../styles/Sidebar.css';
import { UserButton } from '@clerk/clerk-react';

// The list of modules is unchanged.
const modules = [
  { id: 'sentence-generator', name: 'Sentence Generator' },
  { id: 'unscramble-words', name: 'Unscramble Words' },
  { id: 'read-and-respond', name: 'Read & Respond' },
  { id: 'write-a-response', name: 'Write a Response' }
];

function Sidebar({ isOpen, activeModule, onNavigate, onOpenSettings }) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <h1>LinguaFlow</h1>
      
      {modules.map(module => (
        <button
          key={module.id}
          className={`nav-item ${activeModule === module.id ? 'active' : ''}`}
          onClick={() => onNavigate(module.id)}
        >
          {module.name}
        </button>
      ))}

      <div className="user-button-container">
        <UserButton afterSignOutUrl='/' />
      </div>
      <button className="nav-item" onClick={onOpenSettings}>
        Settings
      </button>
      <a
        href="https://github.com/tylertran349/linguaflow/blob/main/README.md"
        target="_blank"
        rel="noopener noreferrer"
        className="nav-item"
      >
        Help
      </a>
      <a
        href="https://github.com/tylertran349/linguaflow/issues"
        target="_blank"
        rel="noopener noreferrer"
        className="nav-item"
      >
        Report a Bug/Make a Suggestion
      </a>
    </aside>
  );
}

export default Sidebar;