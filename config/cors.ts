import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/cors'

const corsConfig = defineConfig({
  enabled: true,
  
  origin: app.inDev 
    ? true  // En développement : autorise toutes les origines
    : ['https://eden-azure-one.vercel.app',"https://ecomerce-api-sc1s.onrender.com"],  // En production : uniquement votre frontend
  
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
