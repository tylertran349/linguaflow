// src/clerkTheme.js

export const clerkAppearance = {
  variables: {
    colorPrimary: '#007bff',
    colorText: '#212529',
    colorBackground: '#ffffff',
    colorInputBackground: '#f8f9fa',
    colorInputText: '#212529',
    borderRadius: '0.75rem',
  },
  elements: {
    card: {
      boxShadow: 'none',
      border: 'none',
    },
    formButtonPrimary: {
      fontSize: '0.9rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      fontWeight: '600',
      transition: 'background-color 0.2s ease-in-out', // Keep the transition
    },
    // The invalid ':hover' block has been removed from here.
    footerActionLink: {
      fontWeight: '600',
    },
  },
};