// src/components/Sidebar.jsx

import React from 'react';
import '../styles/Sidebar.css';

// Add the new game to this list.
const games = [
  { id: 'sentence-generator', name: 'Sentence Generator' },
  { id: 'unscramble-words', name: 'Unscramble Words' },
  { id: 'read-and-respond', name: 'Read & Respond' },
  { id: 'write-a-response', name: 'Write a Response' }
];

function Sidebar({ isOpen, activeGame, onNavigate, onOpenSettings }) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h1>LinguaFlow</h1>
      </div>

      <nav className="sidebar-nav">
        <h2>Games</h2>
        <ul>
          {games.map(game => (
            <li key={game.id}>
              <button
                className={`nav-item ${activeGame === game.id ? 'active' : ''}`}
                onClick={() => onNavigate(game.id)}
              >
                {game.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;