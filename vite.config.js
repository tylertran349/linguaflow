// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Any request starting with /api will be forwarded
      '/api': {
        target: 'http://localhost:3001', // to our proxy server
        changeOrigin: true,
        // We don't need to rewrite the path, '/api/tts' will be sent as is.
      },
    },
  },
});