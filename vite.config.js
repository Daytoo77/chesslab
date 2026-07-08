import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // keep paths on the subst'd build drive (Windows MAX_PATH workaround)
  resolve: { preserveSymlinks: true },
  build: { assetsInlineLimit: 100000000, chunkSizeWarningLimit: 20000 },
});
