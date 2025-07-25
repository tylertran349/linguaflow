import '../styles/Sidebar.css';
// You can use an icon library like react-icons for a better look
// import { FiSettings, FiFileText, FiShuffle } from 'react-icons/fi';

function Sidebar({ onSettingsClick, onActivityChange, currentActivity }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h1 className="logo">LinguaFlow</h1>
        <nav className="activity-nav">
          <button 
            className={`nav-button ${currentActivity === 'generator' ? 'active' : ''}`}
            onClick={() => onActivityChange('generator')}
          >
            {/* <FiFileText />  Icon Example */}
            <span>Sentence Generator</span>
          </button>
          <button 
            className={`nav-button ${currentActivity === 'unscramble' ? 'active' : ''}`}
            onClick={() => onActivityChange('unscramble')}
          >
            {/* <FiShuffle /> Icon Example */}
            <span>Unscramble</span>
          </button>
        </nav>
      </div>
      <div className="sidebar-bottom">
        <button className="nav-button settings-button" onClick={onSettingsClick}>
          {/* <FiSettings /> Icon Example */}
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;