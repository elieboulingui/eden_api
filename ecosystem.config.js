// ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'adonis-backend',
      script: 'node',
      args: 'ace serve --hmr=false',
      instances: 3,           // Lance 3 instances de l'application
      exec_mode: 'cluster',   // Mode cluster pour répartir la charge
      watch: false,           // Désactivé en production
      max_memory_restart: '1G',
      
      // Variables d'environnement
      env: {
        NODE_ENV: 'development',
        PORT: 3333,           // Port de base
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3333,
      },
      
      // Logs
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      
      // Redémarrage automatique
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Incrémentation automatique des ports pour chaque instance
      increment_var: 'PORT',
    },
  ],
}