// src/components/Sidebar.jsx

import React from 'react';
import '../styles/Sidebar.css'; // We'll create this new CSS file

// A list of games. This makes it easy to add more games in the future.
const games = [
  { id: 'sentence-generator', name: 'Sentence Generator' }
  // { id: 'flashcards', name: 'Flashcards' }, // Example of a future game
];

function Sidebar({ isOpen, activeGame, onNavigate, onOpenSettings }) {
  return (
    // The <aside> tag itself is the root of this component.
    // Its open/closed state is controlled by the `isOpen` prop from App.jsx.
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