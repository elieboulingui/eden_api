# start-load-balancer.ps1
# Script PowerShell pour Windows

Write-Host "🚀 Démarrage de l'infrastructure Load Balancer" -ForegroundColor Green

# 1. Créer le dossier des logs
New-Item -ItemType Directory -Force -Path logs | Out-Null

# 2. Arrêter les anciennes instances
Write-Host "📦 Arrêt des anciennes instances PM2..." -ForegroundColor Yellow
pm2 delete adonis-backend 2>$null

# 3. Démarrer les instances AdonisJS
Write-Host "📦 Démarrage de 3 instances AdonisJS..." -ForegroundColor Yellow
pm2 start ecosystem.config.js --env production

# 4. Afficher le statut
Write-Host ""
Write-Host "✅ Infrastructure démarrée !" -ForegroundColor Green
Write-Host ""
pm2 status
Write-Host ""
Write-Host "🌐 Endpoints :" -ForegroundColor Cyan
Write-Host "   - App directe : http://localhost:3333"
Write-Host "   - Health check : http://localhost:3333/health/live"
Write-Host ""
Write-Host "📋 Commandes utiles :" -ForegroundColor Cyan
Write-Host "   pm2 logs    # Voir les logs"
Write-Host "   pm2 status  # Voir le statut"
Write-Host "   pm2 stop all # Tout arrêter"