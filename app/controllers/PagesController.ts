import Order from '#models/Order'

export default class PagesController {
  public async home(ctx: any) {
    const lastOrders = await Order.query()
      .orderBy('created_at', 'desc')
      .limit(5)

    return ctx.view.render('home', {
      appName: process.env.APP_NAME ?? 'Linne',
      message: 'Un aperçu rapide des dernières commandes traitées.',
      orders: lastOrders.map((order) => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        total: order.total,
        customerName: order.customer_name,
      })),
    })
  }
}
