import { defineConfig, loadEnv } from "vite";
  import react from "@vitejs/plugin-react";
  import tailwindcss from "@tailwindcss/vite";
  import path from "path";

  const port = Number(process.env.PORT ?? 5173);
  const basePath = process.env.BASE_PATH ?? "/";

  // Load environment variables - support both .env and system env
  const env = { ...process.env };
  // Allow system env vars to override .env
  try {
    const fs = await import('fs');
    const envFile = fs.readFileSync(path.resolve(import.meta.dirname, '.env'), 'utf-8');
    envFile.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!env[key.trim()]) {
          env[key.trim()] = value;
        }
      }
    });
  } catch (e) {
    // .env file not found, use system env
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://nyoauzqezpxeonmrxxgi.supabase.co';
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2F1enFlenB4ZW9ubXJ4eGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODI3MzUsImV4cCI6MjA4OTg1ODczNX0.5WfECoO2Xu5VfBzFbQd2CA8rIeBVnOkiKmnnbYRA8VU';
  const apiBaseUrl = env.VITE_API_BASE_URL || 'https://admin-dashboard-api-server.vercel.app';

  export default defineConfig({
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
    ],
    // Expose env vars as JSON strings - Vercel will inject these during build
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  });
  