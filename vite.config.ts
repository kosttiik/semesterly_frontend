import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/lks-api': {
        target: 'https://lks.bmstu.ru',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lks-api/, '/lks-back/api/v1'),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'antd'],
          utilities: ['lodash', 'dayjs'],
        },
      },
    },
  },
});
