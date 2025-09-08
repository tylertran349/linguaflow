// src/App.jsx
import { Fragment } from 'react';
import './App.css';
import './styles/clerk-theme.css';
import { Routes, Route, Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react';

import LinguaFlowApp from './LinguaFlowApp';
import { clerkAppearance } from './clerkTheme';

// A shared component for the visual branding side of the auth screen
function AuthVisual() {
  return (
    <div className="split-screen-visual">
      <h1 className="visual-header">LinguaFlow</h1>
      <p className="visual-quote">
        Unlock the world, one sentence at a time.
      </p>
    </div>
  );
}

function App() {
    return (
        <Fragment>
            <SignedOut>
                <div className="auth-container">
                    <div className="split-screen-container">
                        {/* The visual pane is now its own component */}
                        <AuthVisual /> 
                        <div className="split-screen-form">
                            <Routes>
                                <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" appearance={clerkAppearance} />} />
                                <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" appearance={clerkAppearance} />} />
                                <Route path="*" element={<WelcomePage />} />
                            </Routes>
                        </div>
                    </div>
                </div>
            </SignedOut>
            <SignedIn>
                <LinguaFlowApp />
            </SignedIn>
        </Fragment>
    );
}

// The WelcomePage no longer needs the container, as App.jsx provides it.
function WelcomePage() {
    return (
        <div>
            <h1>Welcome to LinguaFlow</h1>
            <p style={{ marginBottom: '2rem' }}>Your journey to language mastery starts here.</p>
            <div className="welcome-buttons">
                <Link to="/sign-in" className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}>Sign In</Link>
                <Link to="/sign-up" className="btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>Sign Up</Link>
            </div>
        </div>
    );
}

export default App;