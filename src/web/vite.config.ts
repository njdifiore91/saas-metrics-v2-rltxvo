import { defineConfig } from 'vite'; // ^4.0.0
import react from '@vitejs/plugin-react'; // ^3.0.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0
import path from 'path';

export default defineConfig(({ mode, command }) => {
  const isDev = mode === 'development';

  return {
    // React plugin configuration with Emotion support
    plugins: [
      react({
        fastRefresh: true,
        babel: {
          plugins: ['@emotion/babel-plugin']
        }
      }),
      tsconfigPaths()
    ],

    // Path resolution configuration
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@services': path.resolve(__dirname, 'src/services'),
        '@utils': path.resolve(__dirname, 'src/utils')
      }
    },

    // Development server configuration
    server: {
      port: 3000,
      host: true,
      open: true,
      cors: true,
      hmr: {
        overlay: true
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true
        }
      }
    },

    // Production build configuration
    build: {
      outDir: 'dist',
      sourcemap: true,
      minify: 'terser',
      target: 'esnext',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            charts: ['d3']
          }
        }
      },
      terserOptions: {
        compress: {
          drop_console: !isDev
        }
      }
    },

    // Test environment configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'src/test/']
      }
    },

    // CSS modules configuration
    css: {
      modules: {
        localsConvention: 'camelCase',
        generateScopedName: '[name]__[local]___[hash:base64:5]'
      },
      preprocessorOptions: {
        scss: {
          additionalData: '@import "@/styles/variables.scss";'
        }
      }
    },

    // Environment and define configuration
    envPrefix: 'VITE_',
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __DEV__: mode === 'development'
    },

    // Optimization settings
    optimizeDeps: {
      include: ['react', 'react-dom', 'd3'],
      exclude: ['@emotion/babel-plugin']
    },

    // EsBuild configuration
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
      jsxInject: `import React from 'react'`
    }
  };
});