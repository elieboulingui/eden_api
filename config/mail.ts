import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER'),

  from: {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  },

  globals: {
    brandName: 'Eden Market',
  },

  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST'),
      port: Number(env.get('SMTP_PORT')),

      secure: false, // ⚠️ important pour port 587 (TLS)

      auth: {
        type: 'login',
        user: env.get('SMTP_USERNAME'),
        pass: env.get('SMTP_PASSWORD'),
      },
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> { }
}
