import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? "https://fmxlfweedredlgpgqufs.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY:
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteGxmd2VlZHJlZGxncGdxdWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzk3ODIsImV4cCI6MjA5MzkxNTc4Mn0.J8u0cQbfoP9vlGpmBa7TnFkEC-Lm-Cq6VY4dewSCX4g",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  },
});
