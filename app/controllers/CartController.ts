import type { HttpContext } from '@adonisjs/core/http'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import Product from '#models/Product'

export default class CartController {
  // Ajouter un produit au panier
  public async add({ request }: HttpContext) {
    const { userId, productId, quantity } = request.body()

    if (!userId || !productId || !quantity) {
      return { success: false, message: 'Champs manquants' }
    }

    let cart = await Cart.query().where('user_id', userId).first()

    if (!cart) {
      cart = await Cart.create({ user_id: userId })
    }

    let item = await CartItem.query()
      .where('cart_id', cart.id)
      .andWhere('product_id', productId)
      .first()

    if (item) {
      ;(item as any).quantity += quantity
      await (item as any).save()
    } else {
      const newItem = new CartItem()
      ;(newItem as any).cart_id = cart.id
      ;(newItem as any).product_id = productId
      ;(newItem as any).quantity = quantity
      await (newItem as any).save()
    }

    return { success: true, message: 'Produit ajouté au panier', cartId: cart.id }
  }

  // GET: Récupérer le panier d'un utilisateur avec les détails des produits
  public async getCart({ params }: HttpContext) {
    const userId = params.userId

    if (!userId) {
      return { success: false, message: 'userId manquant', data: null }
    }

    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    if (!cart) {
      return { success: true, data: null }
    }

    // Récupérer les détails des produits pour chaque item
    const itemsWithProducts = await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.find((item as any).product_id)
        return {
          id: (item as any).id,
          cart_id: (item as any).cart_id,
          product_id: (item as any).product_id,
          quantity: (item as any).quantity,
          product: product
            ? {
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image_url,
                description: product.description,
              }
            : null,
        }
      })
    )

    return {
      success: true,
      data: {
        ...cart.toJSON(),
        items: itemsWithProducts,
      },
    }
  }

  // POST: Récupérer le panier avec les détails des produits
  public async show({ request }: HttpContext) {
    const { userId } = request.body()

    if (!userId) {
      return { success: false, message: 'userId manquant', data: null }
    }

    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    if (!cart) {
      return { success: true, data: null }
    }

    // Récupérer les détails des produits pour chaque item
    const itemsWithProducts = await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.find((item as any).product_id)
        return {
          id: (item as any).id,
          cart_id: (item as any).cart_id,
          product_id: (item as any).product_id,
          quantity: (item as any).quantity,
          product: product
            ? {
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image_url,
                description: product.description,
              }
            : null,
        }
      })
    )

    return {
      success: true,
      data: {
        ...cart.toJSON(),
        items: itemsWithProducts,
      },
    }
  }

  // Mettre à jour le panier
  public async update({ request }: HttpContext) {
    const { userId, items } = request.body()

    if (!userId) {
      return { success: false, message: 'userId manquant' }
    }

    let cart = await Cart.query().where('user_id', userId).first()

    if (!cart) {
      cart = await Cart.create({ user_id: userId })
    }

    await CartItem.query().where('cart_id', cart.id).delete()

    for (const item of items || []) {
      const newItem = new CartItem()
      ;(newItem as any).cart_id = cart.id
      ;(newItem as any).product_id = item.id
      ;(newItem as any).quantity = item.quantity
      await (newItem as any).save()
    }

    return { success: true, message: 'Panier mis à jour' }
  }

  // Supprimer un item
  public async deleteItem({ request, params }: HttpContext) {
    const { userId } = request.body()

    if (!userId) {
      return { success: false, message: 'userId manquant' }
    }

    await CartItem.query()
      .where('id', params.itemId)
      .whereExists((query) => {
        query
          .select('*')
          .from('carts')
          .whereRaw('carts.id = cart_items.cart_id')
          .andWhere('carts.user_id', userId)
      })
      .delete()

    return { success: true, message: 'Item supprimé du panier' }
  }
}