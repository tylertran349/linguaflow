// src/components/Sidebar.jsx

import React from 'react';
import '../styles/Sidebar.css';

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
      <div className="sidebar-header">
        <h1>LinguaFlow</h1>
      </div>

      <nav className="sidebar-nav">
        <h2>Modules</h2>
        <ul>
          {modules.map(module => (
            <li key={module.id}>
              <button
                className={`nav-item ${activeModule === module.id ? 'active' : ''}`}
                onClick={() => onNavigate(module.id)}
              >
                {module.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={onOpenSettings}>
          Settings
        </button>
        {/* --- NEW HELP BUTTON ADDED HERE --- */}
        <a
          href="https://github.com/tylertran349/linguaflow/blob/main/README.md"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-item"
        >
          Help
        </a>
      </div>
    </aside>
  );
}

export default Sidebar;