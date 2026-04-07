// start/health.ts

import { HealthChecks, DiskSpaceCheck, MemoryHeapCheck } from '@adonisjs/core/health'
import { DbCheck } from '@adonisjs/lucid/database'
import app from '@adonisjs/core/services/app'

export const healthChecks = new HealthChecks()

// Vérification de la base de données
healthChecks.register([
  new DbCheck(),
])

// Vérifications supplémentaires (optionnelles mais recommandées)
if (app.inProduction) {
  healthChecks.register([
    // Vérifie l'espace disque disponible (alerte si < 1GB)
    new DiskSpaceCheck().warnWhenExceeds(80).failWhenExceeds(90),

    // Vérifie la mémoire heap utilisée
    new MemoryHeapCheck(),
  ])
}