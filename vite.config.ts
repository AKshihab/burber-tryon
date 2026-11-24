import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// On Windows a terminal can start in "c:\..." (lowercase drive). Vitest then
// loads itself twice under two spellings and fails with "failed to find the
// current suite". Normalise the drive letter before anything else runs.
const cwd = process.cwd();
if (/^[a-z]:/.test(cwd)) process.chdir(cwd[0].toUpperCase() + cwd.slice(1));

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001' } },
  test: { environment: 'node' },
});
