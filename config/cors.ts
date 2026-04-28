import { defineConfig } from '@adonisjs/cors'

const corsConfig = defineConfig({
  enabled: true,
  origin: [
    'http://localhost:3000',      // Next.js dev
    'http://localhost:3333',      // Adonis local
    'https://ton-domaine.com',    // Production
    'https://sous-domaine.ton-domaine.com'  // Sous-domaine (sans regex)
  ],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
  headers: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
