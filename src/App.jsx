// src/App.jsx
import { Fragment } from 'react'; // Use Fragment to avoid extra divs
import './App.css';
import { Routes, Route, Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react';

import LinguaFlowApp from './LinguaFlowApp'; // We will create this component next

function App() {
    return (
        <Fragment>
            <header>
                <SignedOut>
                    <div className="auth-container">
                        <Routes>
                            <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
                            <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />
                            <Route path="*" element={<WelcomePage />} />
                        </Routes>
                    </div>
                </SignedOut>
            </header>
            <main>
                <SignedIn>
                    <LinguaFlowApp />
                </SignedIn>
            </main>
        </Fragment>
    );
}

// A simple welcome page for logged-out users
function WelcomePage() {
    return (
        <div className="welcome-container">
            <h1>Welcome to LinguaFlow</h1>
            <p>Your journey to language mastery starts here.</p>
            <div className="welcome-buttons">
                <Link to="/sign-in" className="btn-primary">Sign In</Link>
                <Link to="/sign-up" className="btn-secondary">Sign Up</Link>
            </div>
        </div>
    );
}

export default App;