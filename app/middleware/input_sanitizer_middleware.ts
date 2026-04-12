// app/middleware/input_sanitizer_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class InputSanitizerMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const body = request.body()
    const query = request.qs()

    // Patterns dangereux
    const dangerousPatterns = [
      /(\bSELECT\b.*\bFROM\b)/i,      // SQL SELECT
      /(\bINSERT\b.*\bINTO\b)/i,      // SQL INSERT
      /(\bUPDATE\b.*\bSET\b)/i,       // SQL UPDATE
      /(\bDELETE\b.*\bFROM\b)/i,      // SQL DELETE
      /(\bDROP\b.*\bTABLE\b)/i,       // SQL DROP
      /(\bUNION\b.*\bSELECT\b)/i,     // SQL UNION
      /(<script.*>)/i,                // XSS script
      /(javascript:)/i,               // XSS javascript
      /(onerror\s*=)/i,               // XSS onerror
      /(onload\s*=)/i,                // XSS onload
      /(\$\{.*\})/i,                  // Template injection
      /(\.\.\/\.\.\/)/i,              // Path traversal
      /(\/etc\/passwd)/i,             // File access
    ]

    // Vérifier toutes les valeurs
    const checkValue = (value: any): boolean => {
      if (typeof value === 'string') {
        for (const pattern of dangerousPatterns) {
          if (pattern.test(value)) {
            return true
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const key in value) {
          if (checkValue(value[key])) {
            return true
          }
        }
      }
      return false
    }

    if (checkValue(body) || checkValue(query)) {
      console.warn(`⚠️ Tentative d'injection détectée - IP: ${request.ip()}`)

      return response.status(403).json({
        success: false,
        message: 'Requête non autorisée',
        error: 'INVALID_INPUT'
      })
    }

    return next()
  }
}
