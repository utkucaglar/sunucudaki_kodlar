"use client"

import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { motion } from 'framer-motion';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <button
      aria-label="Tema Değiştir"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative w-32 h-10 flex items-center px-1 rounded-full border-2 transition-colors duration-300 focus:outline-none shadow-md
        ${isDark ? 'border-gray-700' : 'border-gray-300'}`}
      style={{ minWidth: 110, background: 'transparent' }}
    >
      {/* Moon icon and label */}
      <div className="flex items-center justify-center w-1/2 h-full">
        <Moon className={`w-5 h-5 ${isDark ? 'text-black dark:text-white' : 'text-gray-400'}`} />
        <span className={`ml-1 font-bold text-xs ${isDark ? 'text-black dark:text-white' : 'text-gray-600'}`}>NIGHT</span>
      </div>
      {/* Sun icon and label */}
      <div className="flex items-center justify-center w-1/2 h-full ml-auto">
        <span className={`mr-1 font-bold text-xs ${isDark ? 'text-gray-400' : 'text-black'}`}>DAY</span>
        <Sun className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-yellow-500'}`} />
      </div>
      {/* Animated knob */}
      <motion.div
        className={`absolute top-1 bottom-1 w-7 rounded-full bg-white border-2 shadow flex items-center justify-center ${isDark ? 'left-1' : 'right-1'}`}
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{ zIndex: 2 }}
      >
        {isDark ? <Moon className="w-4 h-4 text-black" /> : <Sun className="w-4 h-4 text-yellow-500" />}
      </motion.div>
    </button>
  );
} 