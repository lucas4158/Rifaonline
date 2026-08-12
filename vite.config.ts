import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_', 'IMGBB_'],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 3000,
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Restore normal chunking
            if (id.includes('node_modules')) {
               if (
                id.includes('react/') ||
                id.includes('react-dom/') ||
                id.includes('scheduler/') ||
                id.includes('use-sync-external-store/') ||
                id.includes('react-is/') ||
                id.includes('prop-types/')
              ) return 'vendor-react';
               if (id.includes('firebase')) return 'vendor-firebase';
               if (id.includes('@supabase')) return 'vendor-supabase';
               if (id.includes('lucide-react')) return 'vendor-lucide';
               if (id.includes('framer-motion') || id.includes('motion')) return 'vendor-motion';
               return 'vendor-core';
            }
          },
        }
      }
    }
  };
});
