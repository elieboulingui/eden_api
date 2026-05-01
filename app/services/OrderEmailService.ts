// app/services/OrderEmailService.ts
import mail from '@adonisjs/mail/services/main'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import User from '#models/user'
import Product from '#models/Product'
import env from '#start/env'

export default class OrderEmailService {

  /**
   * Envoie un email de confirmation de commande au client
   */
  public static async sendOrderConfirmation(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Charger la commande avec toutes les relations
      const order = await Order.query()
        .where('id', orderId)
        .preload('items', (query) => {
          query.preload('product')
        })
        .preload('user')
        .first()

      if (!order) {
        return { success: false, message: 'Commande non trouvée' }
      }

      // Déterminer l'email du client
      const customerEmail = order.customer_email || order.user?.email
      const customerName = order.customer_name || order.user?.full_name || 'Client'

      if (!customerEmail) {
        return { success: false, message: 'Email client introuvable' }
      }

      // Envoyer l'email
      await mail.send((message) => {
        message
          .from('noreply@eden-afrique.com')
          .to(customerEmail)
          .subject(`✅ Confirmation de votre commande #${order.order_number} - Eden`)
          .html(OrderEmailService.getOrderConfirmationTemplate(order, customerName))
      })

      console.log(`📧 Email de confirmation envoyé à ${customerEmail} pour la commande ${order.order_number}`)

      return {
        success: true,
        message: `Email envoyé à ${customerEmail}`
      }
    } catch (error: any) {
      console.error('❌ Erreur envoi email confirmation:', error.message)
      return {
        success: false,
        message: error.message
      }
    }
  }

  /**
   * Envoie un email d'échec de paiement au client
   */
  public static async sendPaymentFailed(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const order = await Order.query()
        .where('id', orderId)
        .preload('items', (query) => {
          query.preload('product')
        })
        .preload('user')
        .first()

      if (!order) {
        return { success: false, message: 'Commande non trouvée' }
      }

      const customerEmail = order.customer_email || order.user?.email
      const customerName = order.customer_name || order.user?.full_name || 'Client'

      if (!customerEmail) {
        return { success: false, message: 'Email client introuvable' }
      }

      await mail.send((message) => {
        message
          .from('noreply@eden-afrique.com')
          .to(customerEmail)
          .subject(`❌ Paiement échoué - Commande #${order.order_number} - Eden`)
          .html(OrderEmailService.getPaymentFailedTemplate(order, customerName))
      })

      console.log(`📧 Email d'échec envoyé à ${customerEmail}`)

      return {
        success: true,
        message: `Email envoyé à ${customerEmail}`
      }
    } catch (error: any) {
      console.error('❌ Erreur envoi email échec:', error.message)
      return {
        success: false,
        message: error.message
      }
    }
  }

  /**
   * Envoie un email au vendeur quand il reçoit une commande
   */
  public static async sendVendorOrderNotification(
    vendorEmail: string,
    vendorName: string,
    order: Order,
    vendorItems: any[]
  ): Promise<{ success: boolean; message: string }> {
    try {
      const vendorTotal = vendorItems.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0)

      await mail.send((message) => {
        message
          .from('noreply@eden-afrique.com')
          .to(vendorEmail)
          .subject(`🛒 Nouvelle commande reçue - ${vendorTotal.toLocaleString()} FCFA - Eden`)
          .html(OrderEmailService.getVendorNotificationTemplate(vendorName, order, vendorItems, vendorTotal))
      })

      return { success: true, message: 'Vendeur notifié' }
    } catch (error: any) {
      console.error('❌ Erreur notification vendeur:', error.message)
      return { success: false, message: error.message }
    }
  }

  /**
   * Envoie un email de confirmation de livraison
   */
  public static async sendDeliveryConfirmation(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const order = await Order.query()
        .where('id', orderId)
        .preload('user')
        .first()

      if (!order) {
        return { success: false, message: 'Commande non trouvée' }
      }

      const customerEmail = order.customer_email || order.user?.email
      const customerName = order.customer_name || order.user?.full_name || 'Client'

      if (!customerEmail) {
        return { success: false, message: 'Email client introuvable' }
      }

      await mail.send((message) => {
        message
          .from('noreply@eden-afrique.com')
          .to(customerEmail)
          .subject(`📦 Votre commande #${order.order_number} est en cours de livraison - Eden`)
          .html(OrderEmailService.getDeliveryTemplate(order, customerName))
      })

      return { success: true, message: 'Email livraison envoyé' }
    } catch (error: any) {
      console.error('❌ Erreur email livraison:', error.message)
      return { success: false, message: error.message }
    }
  }

  // ==================== TEMPLATES HTML ====================

  private static getOrderConfirmationTemplate(order: Order, customerName: string): string {
    const frontendUrl = env.get('FRONTEND_URL', 'https://eden-azure-one.vercel.app')
    const imageUrl = env.get('APP_URL', 'http://localhost:3333') + '/Eden.png'
    const orderUrl = `${frontendUrl}/commandes/${order.id}`

    // Générer les lignes de produits
    const itemsHtml = order.items.map((item: any) => {
      const product = item.product
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${product?.image_url ? `<img src="${product.image_url}" alt="${item.product_name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" />` : ''}
              <div>
                <p style="margin: 0; font-weight: 600; color: #1f2937;">${item.product_name}</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">Qté: ${item.quantity}</p>
              </div>
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #1f2937;">
            ${Number(item.subtotal).toLocaleString()} FCFA
          </td>
        </tr>
      `
    }).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 30px 20px;
          }
          .card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #10b981;
          }
          .header img {
            max-width: 80px;
            height: auto;
            margin-bottom: 10px;
          }
          .header h1 {
            color: #0b6f5b;
            margin: 0;
            font-size: 24px;
          }
          .success-icon {
            text-align: center;
            font-size: 48px;
            margin: 20px 0;
          }
          .order-number {
            background: #f0fdf4;
            color: #065f46;
            padding: 12px 20px;
            border-radius: 8px;
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin: 20px 0;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(135deg, #0b6f5b 0%, #0d9488 100%);
            color: white;
            text-decoration: none;
            padding: 14px 35px;
            border-radius: 50px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .total-row td {
            font-size: 18px;
            font-weight: bold;
            color: #0b6f5b;
            padding-top: 15px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 13px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <img src="${imageUrl}" alt="Eden Logo" />
              <h1>🌿 Eden Marketplace</h1>
            </div>

            <div class="success-icon">✅</div>
            
            <h2 style="text-align: center; color: #1f2937;">Paiement confirmé !</h2>
            <p style="text-align: center; font-size: 16px;">
              Merci <strong>${customerName}</strong> pour votre commande !
            </p>

            <div class="order-number">
              Commande #${order.order_number}
            </div>

            <table>
              <thead>
                <tr>
                  <th style="text-align: left; padding: 12px; border-bottom: 2px solid #e5e7eb; color: #6b7280;">Produit</th>
                  <th style="text-align: right; padding: 12px; border-bottom: 2px solid #e5e7eb; color: #6b7280;">Montant</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr>
                  <td style="padding: 12px; color: #6b7280;">Sous-total</td>
                  <td style="padding: 12px; text-align: right; font-weight: 600;">${Number(order.subtotal).toLocaleString()} FCFA</td>
                </tr>
                <tr>
                  <td style="padding: 12px; color: #6b7280;">Livraison</td>
                  <td style="padding: 12px; text-align: right; font-weight: 600;">${Number(order.shipping_cost || 0).toLocaleString()} FCFA</td>
                </tr>
                <tr class="total-row">
                  <td style="padding: 12px;">Total</td>
                  <td style="text-align: right; padding: 12px;">${Number(order.total).toLocaleString()} FCFA</td>
                </tr>
              </tbody>
            </table>

            <div style="text-align: center; margin: 30px 0;">
              <p><strong>Méthode de paiement :</strong> ${order.payment_method || 'Mobile Money'}</p>
              <p><strong>Adresse de livraison :</strong> ${order.shipping_address || 'Non renseignée'}</p>
              <p><strong>Mode de livraison :</strong> ${order.delivery_method || 'Standard'}</p>
            </div>

            <div style="text-align: center;">
              <a href="${orderUrl}" class="btn">📦 Suivre ma commande</a>
            </div>

            <div class="footer">
              <p>© ${new Date().getFullYear()} Eden . Tous droits réservés.</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  private static getPaymentFailedTemplate(order: Order, customerName: string): string {
    const frontendUrl = env.get('FRONTEND_URL', 'https://eden-azure-one.vercel.app')
    const retryUrl = `${frontendUrl}/panier`

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 30px 20px; }
          .card { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
          .failed-icon { font-size: 48px; margin: 20px 0; }
          h2 { color: #dc2626; }
          .btn { display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 14px 35px; border-radius: 50px; font-weight: bold; margin: 20px 0; }
          .info { color: #6b7280; font-size: 14px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="failed-icon">❌</div>
            <h2>Paiement échoué</h2>
            <p>Bonjour <strong>${customerName}</strong>,</p>
            <p>Votre paiement de <strong style="color: #dc2626;">${Number(order.total).toLocaleString()} FCFA</strong> pour la commande <strong>#${order.order_number}</strong> n'a pas abouti.</p>
            <p class="info">Aucun débit n'a été effectué sur votre compte.</p>
            <a href="${retryUrl}" class="btn">🔄 Réessayer le paiement</a>
            <p style="margin-top: 30px; color: #6b7280; font-size: 13px;">Si vous avez besoin d'aide, contactez notre support.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  private static getVendorNotificationTemplate(
    vendorName: string,
    order: Order,
    vendorItems: any[],
    vendorTotal: number
  ): string {
    const itemsHtml = vendorItems.map((item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.product_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Number(item.price).toLocaleString()} FCFA</td>
      </tr>
    `).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: white; border-radius: 12px; padding: 25px;">
          <h2 style="color: #0b6f5b;">🛒 Nouvelle commande !</h2>
          <p>Bonjour <strong>${vendorName}</strong>,</p>
          <p>Vous avez reçu une commande de <strong>${order.customer_name || 'Client'}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <thead><tr style="background: #f0fdf4; color: #0b6f5b;">
              <th style="text-align: left; padding: 10px;">Produit</th>
              <th style="padding: 10px;">Qté</th>
              <th style="text-align: right; padding: 10px;">Prix</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <p style="text-align: right; font-size: 18px; font-weight: bold; color: #0b6f5b;">Total : ${vendorTotal.toLocaleString()} FCFA</p>
          <p style="font-size: 13px; color: #6b7280;">Commande #${order.order_number} • ${order.created_at?.toFormat('dd/MM/yyyy à HH:mm')}</p>
        </div>
      </body>
      </html>
    `
  }

  private static getDeliveryTemplate(order: Order, customerName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: white; border-radius: 12px; padding: 25px; text-align: center;">
          <div style="font-size: 48px;">📦</div>
          <h2 style="color: #0b6f5b;">Votre commande est en route !</h2>
          <p>Bonjour <strong>${customerName}</strong>,</p>
          <p>Votre commande <strong>#${order.order_number}</strong> est en cours de livraison.</p>
          <p style="font-size: 14px; color: #6b7280;">Adresse : ${order.shipping_address}</p>
          ${order.tracking_number ? `<p style="font-weight: bold;">N° de suivi : ${order.tracking_number}</p>` : ''}
        </div>
      </body>
      </html>
    `
  }
}
