import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import Product from '#models/Product' // Ajouter l'import Product

export default class CartController {
  // Ajouter un produit au panier
  public async add({ request }: HttpContextContract) {
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
      item.quantity += quantity
      await item.save()
    } else {
      await CartItem.create({
        cart_id: cart.id,
        product_id: productId,
        quantity,
      })
    }

    return { success: true, message: 'Produit ajouté au panier', cartId: cart.id }
  }

  // GET: Récupérer le panier d'un utilisateur avec les détails des produits
  public async getCart({ params }: HttpContextContract) {
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
        const product = await Product.find(item.product_id)
        return {
          id: item.id,
          cart_id: item.cart_id,
          product_id: item.product_id,
          quantity: item.quantity,
          product: product ? {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            description: product.description
          } : null
        }
      })
    )

    return { 
      success: true, 
      data: {
        ...cart.toJSON(),
        items: itemsWithProducts
      }
    }
  }

  // POST: Récupérer le panier avec les détails des produits
  public async show({ request }: HttpContextContract) {
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
        const product = await Product.find(item.product_id)
        return {
          id: item.id,
          cart_id: item.cart_id,
          product_id: item.product_id,
          quantity: item.quantity,
          product: product ? {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            description: product.description
          } : null
        }
      })
    )

    return { 
      success: true, 
      data: {
        ...cart.toJSON(),
        items: itemsWithProducts
      }
    }
  }

  // Mettre à jour le panier
  public async update({ request }: HttpContextContract) {
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
      await CartItem.create({
        cart_id: cart.id,
        product_id: item.id,
        quantity: item.quantity,
      })
    }

    return { success: true, message: 'Panier mis à jour' }
  }

  // Supprimer un item
  public async deleteItem({ request, params }: HttpContextContract) {
    const { userId } = request.body()

    if (!userId) {
      return { success: false, message: 'userId manquant' }
    }

    await CartItem.query()
      .where('id', params.itemId)
      .where('cart_id', (q) => q.select('id').from('carts').where('user_id', userId))
      .delete()

    return { success: true, message: 'Item supprimé du panier' }
  }
}