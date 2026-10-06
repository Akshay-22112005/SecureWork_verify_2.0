import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '', size = 'md' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${size} ${className}`}
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
    >
      <div className="theme-toggle-track">
        <div className={`theme-toggle-thumb ${isDark ? 'dark' : 'light'}`}>
          {isDark ? (
            <Moon size={14} className="theme-icon moon-icon" />
          ) : (
            <Sun size={14} className="theme-icon sun-icon" />
          )}
        </div>
      </div>
      <span className="theme-toggle-label sr-only">
        {isDark ? 'Dark Theme' : 'Light Theme'}
      </span>
    </button>
  );
}
