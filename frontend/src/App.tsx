import React from 'react';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ChatApp } from '@/components/ChatApp';

function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <ChatApp />
      </div>
    </ThemeProvider>
  );
}

export default App;