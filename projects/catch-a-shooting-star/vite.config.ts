import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    proxy: {
      // Proxy API requests to Vercel in development
      '/api': {
        target: 'https://catch-a-shooting-star.vercel.app',
        changeOrigin: true,
      },
    },
  },
});
