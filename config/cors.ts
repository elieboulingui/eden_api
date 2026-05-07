import { defineConfig } from '@adonisjs/cors'

export default defineConfig({
  enabled: true,
  origin: true, // Autorise toutes les origines
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  headers: true,
  exposeHeaders: ['*'],
  credentials: true,
  maxAge: 90,
})
