// frontend/src/contexts/ThemeContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';

// Create the Theme Context
const ThemeContext = createContext();

// Create a provider component
export const ThemeProvider = ({ children }) => {
  // Get theme preference from local storage or default to 'light'
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Effect to update local storage and body class when theme changes
  useEffect(() => {
    localStorage.setItem('theme', theme);
    // Add or remove a class on the body element to apply theme-specific styles
    document.body.className = theme;
  }, [theme]);

  // Function to toggle between light and dark themes
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to easily access the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

