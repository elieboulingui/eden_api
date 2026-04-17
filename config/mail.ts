import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

// Vérifier que les variables essentielles sont présentes
const requiredEnvVars = [
  'MAIL_MAILER',
  'MAIL_FROM_ADDRESS',
  'MAIL_FROM_NAME',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USERNAME',
  'SMTP_PASSWORD'
]

// Optionnel : Vérifier en développement
if (process.env.NODE_ENV === 'production') {
  for (const envVar of requiredEnvVars) {
    if (!env.get(envVar)) {
      throw new Error(`Missing required environment variable: ${envVar}`)
    }
  }
}

const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER') || 'smtp',

  from: {
    address: env.get('MAIL_FROM_ADDRESS') || 'noreply@eden-marketplace.com',
    name: env.get('MAIL_FROM_NAME') || 'Eden Marketplace',
  },

  globals: {
    brandName: 'Eden Market',
  },

  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST') || 'localhost',
      port: Number(env.get('SMTP_PORT') || 587),

      secure: env.get('SMTP_SECURE') === 'true' || false, // Ajout optionnel

      auth: {
        type: 'login',
        user: env.get('SMTP_USERNAME') || '',
        pass: env.get('SMTP_PASSWORD') || '',
      },
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> { }
}
