// app/controllers/CartController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import Product from '#models/Product'
import User from '#models/user'

export default class CartController {

  /**
   * Helper pour résoudre l'ID utilisateur (UUID string)
   */
  private async resolveUserId(userIdentifier: string | number): Promise<string | null> {
    console.log('🔍 [Resolve] Tentative pour User:', userIdentifier)

    // On cherche par ID directement (puisque ton ID est l'UUID en base)
    const user = await User.find(userIdentifier)
    if (user) {
      console.log('✅ [Resolve] User trouvé:', user.id)
      return user.id
    }

    console.error('❌ [Resolve] Utilisateur introuvable pour:', userIdentifier)
    return null
  }

  // AJOUTER AU PANIER
  public async add({ request, response }: HttpContext) {
    const { userId, productId, quantity } = request.body()
    console.log('🔵 [Cart.add] - Données reçues:', { userId, productId, quantity })

    const resolvedUserId = await this.resolveUserId(userId)
    if (!resolvedUserId) {
      return response.badRequest({ success: false, message: 'Utilisateur non trouvé' })
    }

    const product = await Product.find(productId)
    if (!product) {
      console.error('❌ Produit non trouvé ID:', productId)
      return response.notFound({ success: false, message: 'Produit non trouvé' })
    }

    let cart = await Cart.query().where('user_id', resolvedUserId).first()
    if (!cart) {
      cart = await Cart.create({ user_id: resolvedUserId })
      console.log('🛒 Nouveau panier créé ID:', cart.id)
    }

    let item = await CartItem.query()
      .where('cart_id', cart.id)
      .andWhere('product_id', product.id)
      .first()

    if (item) {
      item.quantity += quantity
      await item.save()
      console.log(`📦 Quantité mise à jour: ${item.quantity}`)
    } else {
      await CartItem.create({
        cart_id: cart.id,
        product_id: product.id,
        quantity: quantity
      })
      console.log(`📦 Nouvel item ajouté`)
    }

    return { success: true, message: 'Produit ajouté', cartId: cart.id }
  }

  // RÉCUPÉRER LE PANIER (via Params)
  public async getCart({ params, response }: HttpContext) {
    const resolvedUserId = await this.resolveUserId(params.userId)
    if (!resolvedUserId) return response.notFound({ success: false, message: 'User non trouvé' })

    const cart = await Cart.query().where('user_id', resolvedUserId).preload('items').first()
    if (!cart) return { success: true, data: { items: [] } }

    const itemsWithProducts = await this.enrichItems(cart.items)
    return { success: true, data: { ...cart.toJSON(), items: itemsWithProducts } }
  }

  // RÉCUPÉRER LE PANIER (via Body - Souvent utilisé pour le "show")
  public async show({ request, response }: HttpContext) {
    const { userId } = request.body()
    const resolvedUserId = await this.resolveUserId(userId)
    if (!resolvedUserId) return response.notFound({ success: false, message: 'User non trouvé' })

    const cart = await Cart.query().where('user_id', resolvedUserId).preload('items').first()
    if (!cart) return { success: true, data: null }

    const itemsWithProducts = await this.enrichItems(cart.items)
    return { success: true, data: { ...cart.toJSON(), items: itemsWithProducts } }
  }

  // METTRE À JOUR LE PANIER (C'est cette méthode qui manquait dans tes logs !)
  public async update({ request, response }: HttpContext) {
    const { userId, items } = request.body()
    console.log('🔵 [Cart.update] - userId:', userId)

    const resolvedUserId = await this.resolveUserId(userId)
    if (!resolvedUserId) return response.notFound({ success: false, message: 'User non trouvé' })

    let cart = await Cart.query().where('user_id', resolvedUserId).first()
    if (!cart) {
      cart = await Cart.create({ user_id: resolvedUserId })
    }

    // On vide l'ancien panier et on remet les nouveaux items
    await CartItem.query().where('cart_id', cart.id).delete()
    console.log('🧹 Panier vidé, réimportation des items...')

    for (const item of items || []) {
      await CartItem.create({
        cart_id: cart.id,
        product_id: item.id, // On suppose que le front envoie l'id du produit
        quantity: item.quantity
      })
    }

    return { success: true, message: 'Panier mis à jour' }
  }

  // SUPPRIMER ITEM
  public async deleteItem({ request, params }: HttpContext) {
    const { userId } = request.body()
    const resolvedUserId = await this.resolveUserId(userId)
    if (!resolvedUserId) return { success: false, message: 'User non trouvé' }

    await CartItem.query()
      .where('id', params.itemId)
      .whereExists((query) => {
        query.select('*').from('carts')
          .whereRaw('carts.id = cart_items.cart_id')
          .andWhere('carts.user_id', resolvedUserId)
      })
      .delete()

    console.log('🗑️ Item supprimé:', params.itemId)
    return { success: true, message: 'Item supprimé' }
  }

  // HELPER ENRICHISSEMENT
  private async enrichItems(items: CartItem[]) {
    return await Promise.all(
      items.map(async (item) => {
        const product = await Product.find(item.product_id)
        return {
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          product: product ? {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image_url, // Assurez-vous que c'est bien "image_url" dans votre modèle Product
          } : null
        }
      })
    )
  }
}
