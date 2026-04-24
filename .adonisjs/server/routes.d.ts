import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.web.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.web.store': { paramsTuple?: []; params?: {} }
    'session.web.destroy': { paramsTuple?: []; params?: {} }
    'dashboard.admin': { paramsTuple?: []; params?: {} }
    'dashboard.secretary': { paramsTuple?: []; params?: {} }
    'dashboard.manager': { paramsTuple?: []; params?: {} }
    'dashboard.promotions': { paramsTuple?: []; params?: {} }
    'api.register': { paramsTuple?: []; params?: {} }
    'api.login': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'api.logout': { paramsTuple?: []; params?: {} }
    'api.profile.update': { paramsTuple?: []; params?: {} }
    'api.profile.password': { paramsTuple?: []; params?: {} }
    'api.profile': { paramsTuple?: []; params?: {} }
    'otp.send': { paramsTuple?: []; params?: {} }
    'otp.verify': { paramsTuple?: []; params?: {} }
    'otp.status': { paramsTuple?: []; params?: {} }
    'otp.resend': { paramsTuple?: []; params?: {} }
    'password.reset': { paramsTuple?: []; params?: {} }
    'kyc.index': { paramsTuple?: []; params?: {} }
    'kyc.stats': { paramsTuple?: []; params?: {} }
    'kyc.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.store': { paramsTuple?: []; params?: {} }
    'kyc.verify': { paramsTuple: [ParamValue]; params: {'numeroTelephone': ParamValue} }
    'kyc.search.phone': { paramsTuple?: []; params?: {} }
    'kyc.search.name': { paramsTuple?: []; params?: {} }
    'kyc.filter.operator': { paramsTuple?: []; params?: {} }
    'kyc.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'blog.index': { paramsTuple?: []; params?: {} }
    'blog.featured': { paramsTuple?: []; params?: {} }
    'blog.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'blog.submit': { paramsTuple?: []; params?: {} }
    'admin.posts.index': { paramsTuple?: []; params?: {} }
    'admin.posts.stats': { paramsTuple?: []; params?: {} }
    'admin.posts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.posts.store': { paramsTuple?: []; params?: {} }
    'admin.posts.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.posts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'testimonials.index': { paramsTuple?: []; params?: {} }
    'testimonials.store': { paramsTuple?: []; params?: {} }
    'testimonials.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'testimonials.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'testimonials.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'produits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.store': { paramsTuple?: []; params?: {} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'contacts.store': { paramsTuple?: []; params?: {} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'name': ParamValue} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.products.create': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cart.get': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'cart.show': { paramsTuple?: []; params?: {} }
    'cart.add': { paramsTuple?: []; params?: {} }
    'cart.updateItem': { paramsTuple?: []; params?: {} }
    'cart.update': { paramsTuple?: []; params?: {} }
    'cart.item.delete': { paramsTuple: [ParamValue]; params: {'itemId': ParamValue} }
    'cart.clear': { paramsTuple?: []; params?: {} }
    'favorites.add': { paramsTuple?: []; params?: {} }
    'favorites.remove': { paramsTuple?: []; params?: {} }
    'favorites.index': { paramsTuple?: []; params?: {} }
    'favorites.check': { paramsTuple?: []; params?: {} }
    'orders.store': { paramsTuple?: []; params?: {} }
    'orders.all': { paramsTuple?: []; params?: {} }
    'orders.user.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.cancel': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.status.update': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.qr.generate': { paramsTuple?: []; params?: {} }
    'orders.qr.confirm': { paramsTuple?: []; params?: {} }
    'orders.check-payment': { paramsTuple: [ParamValue]; params: {'referenceId': ParamValue} }
    'orders.payment-status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.link.generate': { paramsTuple?: []; params?: {} }
    'orders.callback': { paramsTuple?: []; params?: {} }
    'payment.without-id': { paramsTuple: [ParamValue]; params: {'referenceId': ParamValue} }
    'payment.status': { paramsTuple: [ParamValue]; params: {'referenceId': ParamValue} }
    'tracking.search': { paramsTuple?: []; params?: {} }
    'tracking.events': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'tracking.event.add': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'tracking.status.update': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'coupons.index': { paramsTuple?: []; params?: {} }
    'coupons.apply': { paramsTuple?: []; params?: {} }
    'coupons.verify': { paramsTuple?: []; params?: {} }
    'coupons.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'promo.index': { paramsTuple?: []; params?: {} }
    'banners.index': { paramsTuple?: []; params?: {} }
    'flash-sales.index': { paramsTuple?: []; params?: {} }
    'promo.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'promo.store': { paramsTuple?: []; params?: {} }
    'promo.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'promo.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.index': { paramsTuple?: []; params?: {} }
    'pubs.store': { paramsTuple?: []; params?: {} }
    'pubs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.toggle': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'newsletter.subscribe': { paramsTuple?: []; params?: {} }
    'push.index': { paramsTuple?: []; params?: {} }
    'push.store': { paramsTuple?: []; params?: {} }
    'push.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchant.give-change.status': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'merchant.give-change.history': { paramsTuple?: []; params?: {} }
    'merchant.give-change.stats': { paramsTuple?: []; params?: {} }
    'merchant.give-change.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchant.withdraw': { paramsTuple?: []; params?: {} }
    'merchant.withdrawals': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.wallet': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.dashboard': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.stats': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.orders.all': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.orders.pending': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.orders.detail': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'orderId': ParamValue} }
    'merchant.orders.recent': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.products.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.products.store': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.products.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.archived-products.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.archived-products.restore': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.archived-products.permanent-delete': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.archived-products.restful.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.archived-products.restful.restore': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.archived-products.restful.permanent-delete': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.categories.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.categories.store': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'merchant.categories.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'merchant.coupons.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.coupons.store': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.coupons.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'merchant.coupons.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'merchants.index': { paramsTuple?: []; params?: {} }
    'merchants.all': { paramsTuple?: []; params?: {} }
    'merchants.active': { paramsTuple?: []; params?: {} }
    'merchants.search': { paramsTuple?: []; params?: {} }
    'merchants.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchants.stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.get_product_reviews': { paramsTuple: [ParamValue]; params: {'productId': ParamValue} }
    'reviews.get_merchant_reviews': { paramsTuple: [ParamValue]; params: {'merchantId': ParamValue} }
    'reviews.my_reviews': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'reviews.mark_helpful': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.store': { paramsTuple?: []; params?: {} }
    'reviews.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.index': { paramsTuple?: []; params?: {} }
    'reviews.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.approve': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.reject': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.shop.index': { paramsTuple?: []; params?: {} }
    'api.shop.coupons': { paramsTuple?: []; params?: {} }
    'api.shop.promotions': { paramsTuple?: []; params?: {} }
    'mypvit.renew-secret': { paramsTuple?: []; params?: {} }
    'mypvit.secret': { paramsTuple?: []; params?: {} }
    'mypvit.countries': { paramsTuple?: []; params?: {} }
    'mypvit.operators': { paramsTuple?: []; params?: {} }
    'mypvit.countries-operators': { paramsTuple?: []; params?: {} }
    'mypvit.check-operator': { paramsTuple?: []; params?: {} }
    'mypvit.clear-cache': { paramsTuple?: []; params?: {} }
    'mypvit.kyc': { paramsTuple?: []; params?: {} }
    'mypvit.kyc.active': { paramsTuple?: []; params?: {} }
    'mypvit.kyc.verify': { paramsTuple?: []; params?: {} }
    'mypvit.qrcode.generate': { paramsTuple?: []; params?: {} }
    'mypvit.qrcode.static': { paramsTuple?: []; params?: {} }
    'mypvit.qrcode.dynamic': { paramsTuple?: []; params?: {} }
    'mypvit.qrcode.image': { paramsTuple?: []; params?: {} }
    'mypvit.transaction.payment': { paramsTuple?: []; params?: {} }
    'mypvit.transaction.give-change': { paramsTuple?: []; params?: {} }
    'mypvit.transaction.status': { paramsTuple?: []; params?: {} }
    'mypvit.link.web': { paramsTuple?: []; params?: {} }
    'mypvit.link.visa': { paramsTuple?: []; params?: {} }
    'mypvit.link.rest': { paramsTuple?: []; params?: {} }
    'mypvit.balance': { paramsTuple?: []; params?: {} }
    'orders.pay.mobile-money': { paramsTuple?: []; params?: {} }
    'orders.pay.qr-code': { paramsTuple?: []; params?: {} }
    'orders.pay.link': { paramsTuple?: []; params?: {} }
    'callback': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard.admin': { paramsTuple?: []; params?: {} }
    'dashboard.secretary': { paramsTuple?: []; params?: {} }
    'dashboard.manager': { paramsTuple?: []; params?: {} }
    'dashboard.promotions': { paramsTuple?: []; params?: {} }
    'api.profile': { paramsTuple?: []; params?: {} }
    'otp.status': { paramsTuple?: []; params?: {} }
    'kyc.index': { paramsTuple?: []; params?: {} }
    'kyc.stats': { paramsTuple?: []; params?: {} }
    'kyc.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.verify': { paramsTuple: [ParamValue]; params: {'numeroTelephone': ParamValue} }
    'kyc.search.phone': { paramsTuple?: []; params?: {} }
    'kyc.search.name': { paramsTuple?: []; params?: {} }
    'kyc.filter.operator': { paramsTuple?: []; params?: {} }
    'blog.index': { paramsTuple?: []; params?: {} }
    'blog.featured': { paramsTuple?: []; params?: {} }
    'blog.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'admin.posts.index': { paramsTuple?: []; params?: {} }
    'admin.posts.stats': { paramsTuple?: []; params?: {} }
    'admin.posts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'testimonials.index': { paramsTuple?: []; params?: {} }
    'testimonials.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'produits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'name': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cart.get': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'favorites.index': { paramsTuple?: []; params?: {} }
    'favorites.check': { paramsTuple?: []; params?: {} }
    'orders.all': { paramsTuple?: []; params?: {} }
    'orders.user.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.check-payment': { paramsTuple: [ParamValue]; params: {'referenceId': ParamValue} }
    'orders.payment-status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'payment.without-id': { paramsTuple: [ParamValue]; params: {'referenceId': ParamValue} }
    'payment.status': { paramsTuple: [ParamValue]; params: {'referenceId': ParamValue} }
    'tracking.events': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'coupons.index': { paramsTuple?: []; params?: {} }
    'coupons.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'promo.index': { paramsTuple?: []; params?: {} }
    'banners.index': { paramsTuple?: []; params?: {} }
    'flash-sales.index': { paramsTuple?: []; params?: {} }
    'promo.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.index': { paramsTuple?: []; params?: {} }
    'push.index': { paramsTuple?: []; params?: {} }
    'merchant.give-change.status': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'merchant.give-change.history': { paramsTuple?: []; params?: {} }
    'merchant.give-change.stats': { paramsTuple?: []; params?: {} }
    'merchant.withdrawals': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.wallet': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.dashboard': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.stats': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.orders.all': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.orders.pending': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.orders.detail': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'orderId': ParamValue} }
    'merchant.orders.recent': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.products.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.archived-products.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.archived-products.restful.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.categories.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.coupons.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchants.index': { paramsTuple?: []; params?: {} }
    'merchants.all': { paramsTuple?: []; params?: {} }
    'merchants.active': { paramsTuple?: []; params?: {} }
    'merchants.search': { paramsTuple?: []; params?: {} }
    'merchants.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchants.stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.get_product_reviews': { paramsTuple: [ParamValue]; params: {'productId': ParamValue} }
    'reviews.get_merchant_reviews': { paramsTuple: [ParamValue]; params: {'merchantId': ParamValue} }
    'reviews.my_reviews': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'reviews.index': { paramsTuple?: []; params?: {} }
    'reviews.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.shop.index': { paramsTuple?: []; params?: {} }
    'api.shop.coupons': { paramsTuple?: []; params?: {} }
    'api.shop.promotions': { paramsTuple?: []; params?: {} }
    'mypvit.secret': { paramsTuple?: []; params?: {} }
    'mypvit.countries': { paramsTuple?: []; params?: {} }
    'mypvit.operators': { paramsTuple?: []; params?: {} }
    'mypvit.countries-operators': { paramsTuple?: []; params?: {} }
    'mypvit.check-operator': { paramsTuple?: []; params?: {} }
    'mypvit.kyc': { paramsTuple?: []; params?: {} }
    'mypvit.kyc.active': { paramsTuple?: []; params?: {} }
    'mypvit.transaction.status': { paramsTuple?: []; params?: {} }
    'mypvit.balance': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard.admin': { paramsTuple?: []; params?: {} }
    'dashboard.secretary': { paramsTuple?: []; params?: {} }
    'dashboard.manager': { paramsTuple?: []; params?: {} }
    'dashboard.promotions': { paramsTuple?: []; params?: {} }
    'api.profile': { paramsTuple?: []; params?: {} }
    'otp.status': { paramsTuple?: []; params?: {} }
    'kyc.index': { paramsTuple?: []; params?: {} }
    'kyc.stats': { paramsTuple?: []; params?: {} }
    'kyc.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.verify': { paramsTuple: [ParamValue]; params: {'numeroTelephone': ParamValue} }
    'kyc.search.phone': { paramsTuple?: []; params?: {} }
    'kyc.search.name': { paramsTuple?: []; params?: {} }
    'kyc.filter.operator': { paramsTuple?: []; params?: {} }
    'blog.index': { paramsTuple?: []; params?: {} }
    'blog.featured': { paramsTuple?: []; params?: {} }
    'blog.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'admin.posts.index': { paramsTuple?: []; params?: {} }
    'admin.posts.stats': { paramsTuple?: []; params?: {} }
    'admin.posts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'testimonials.index': { paramsTuple?: []; params?: {} }
    'testimonials.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'produits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'name': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cart.get': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'favorites.index': { paramsTuple?: []; params?: {} }
    'favorites.check': { paramsTuple?: []; params?: {} }
    'orders.all': { paramsTuple?: []; params?: {} }
    'orders.user.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.check-payment': { paramsTuple: [ParamValue]; params: {'referenceId': ParamValue} }
    'orders.payment-status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'payment.without-id': { paramsTuple: [ParamValue]; params: {'referenceId': ParamValue} }
    'payment.status': { paramsTuple: [ParamValue]; params: {'referenceId': ParamValue} }
    'tracking.events': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'coupons.index': { paramsTuple?: []; params?: {} }
    'coupons.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'promo.index': { paramsTuple?: []; params?: {} }
    'banners.index': { paramsTuple?: []; params?: {} }
    'flash-sales.index': { paramsTuple?: []; params?: {} }
    'promo.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.index': { paramsTuple?: []; params?: {} }
    'push.index': { paramsTuple?: []; params?: {} }
    'merchant.give-change.status': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'merchant.give-change.history': { paramsTuple?: []; params?: {} }
    'merchant.give-change.stats': { paramsTuple?: []; params?: {} }
    'merchant.withdrawals': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.wallet': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.dashboard': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.stats': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.orders.all': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.orders.pending': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.orders.detail': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'orderId': ParamValue} }
    'merchant.orders.recent': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.products.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.archived-products.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.archived-products.restful.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.categories.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.coupons.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchants.index': { paramsTuple?: []; params?: {} }
    'merchants.all': { paramsTuple?: []; params?: {} }
    'merchants.active': { paramsTuple?: []; params?: {} }
    'merchants.search': { paramsTuple?: []; params?: {} }
    'merchants.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchants.stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.get_product_reviews': { paramsTuple: [ParamValue]; params: {'productId': ParamValue} }
    'reviews.get_merchant_reviews': { paramsTuple: [ParamValue]; params: {'merchantId': ParamValue} }
    'reviews.my_reviews': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'reviews.index': { paramsTuple?: []; params?: {} }
    'reviews.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.shop.index': { paramsTuple?: []; params?: {} }
    'api.shop.coupons': { paramsTuple?: []; params?: {} }
    'api.shop.promotions': { paramsTuple?: []; params?: {} }
    'mypvit.secret': { paramsTuple?: []; params?: {} }
    'mypvit.countries': { paramsTuple?: []; params?: {} }
    'mypvit.operators': { paramsTuple?: []; params?: {} }
    'mypvit.countries-operators': { paramsTuple?: []; params?: {} }
    'mypvit.check-operator': { paramsTuple?: []; params?: {} }
    'mypvit.kyc': { paramsTuple?: []; params?: {} }
    'mypvit.kyc.active': { paramsTuple?: []; params?: {} }
    'mypvit.transaction.status': { paramsTuple?: []; params?: {} }
    'mypvit.balance': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'new_account.web.store': { paramsTuple?: []; params?: {} }
    'session.web.store': { paramsTuple?: []; params?: {} }
    'session.web.destroy': { paramsTuple?: []; params?: {} }
    'api.register': { paramsTuple?: []; params?: {} }
    'api.login': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'api.logout': { paramsTuple?: []; params?: {} }
    'otp.send': { paramsTuple?: []; params?: {} }
    'otp.verify': { paramsTuple?: []; params?: {} }
    'otp.resend': { paramsTuple?: []; params?: {} }
    'password.reset': { paramsTuple?: []; params?: {} }
    'kyc.store': { paramsTuple?: []; params?: {} }
    'blog.submit': { paramsTuple?: []; params?: {} }
    'admin.posts.store': { paramsTuple?: []; params?: {} }
    'testimonials.store': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'contacts.store': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'categories.products.create': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cart.show': { paramsTuple?: []; params?: {} }
    'cart.add': { paramsTuple?: []; params?: {} }
    'favorites.add': { paramsTuple?: []; params?: {} }
    'favorites.remove': { paramsTuple?: []; params?: {} }
    'orders.store': { paramsTuple?: []; params?: {} }
    'orders.cancel': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.qr.generate': { paramsTuple?: []; params?: {} }
    'orders.qr.confirm': { paramsTuple?: []; params?: {} }
    'orders.link.generate': { paramsTuple?: []; params?: {} }
    'orders.callback': { paramsTuple?: []; params?: {} }
    'tracking.search': { paramsTuple?: []; params?: {} }
    'tracking.event.add': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'coupons.apply': { paramsTuple?: []; params?: {} }
    'coupons.verify': { paramsTuple?: []; params?: {} }
    'promo.store': { paramsTuple?: []; params?: {} }
    'pubs.store': { paramsTuple?: []; params?: {} }
    'newsletter.subscribe': { paramsTuple?: []; params?: {} }
    'push.store': { paramsTuple?: []; params?: {} }
    'merchant.give-change.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchant.withdraw': { paramsTuple?: []; params?: {} }
    'merchant.products.store': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.archived-products.restore': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.archived-products.restful.restore': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.categories.store': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant.coupons.store': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'reviews.mark_helpful': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.store': { paramsTuple?: []; params?: {} }
    'mypvit.renew-secret': { paramsTuple?: []; params?: {} }
    'mypvit.clear-cache': { paramsTuple?: []; params?: {} }
    'mypvit.kyc.verify': { paramsTuple?: []; params?: {} }
    'mypvit.qrcode.generate': { paramsTuple?: []; params?: {} }
    'mypvit.qrcode.static': { paramsTuple?: []; params?: {} }
    'mypvit.qrcode.dynamic': { paramsTuple?: []; params?: {} }
    'mypvit.qrcode.image': { paramsTuple?: []; params?: {} }
    'mypvit.transaction.payment': { paramsTuple?: []; params?: {} }
    'mypvit.transaction.give-change': { paramsTuple?: []; params?: {} }
    'mypvit.link.web': { paramsTuple?: []; params?: {} }
    'mypvit.link.visa': { paramsTuple?: []; params?: {} }
    'mypvit.link.rest': { paramsTuple?: []; params?: {} }
    'orders.pay.mobile-money': { paramsTuple?: []; params?: {} }
    'orders.pay.qr-code': { paramsTuple?: []; params?: {} }
    'orders.pay.link': { paramsTuple?: []; params?: {} }
    'callback': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'api.profile.update': { paramsTuple?: []; params?: {} }
    'api.profile.password': { paramsTuple?: []; params?: {} }
    'kyc.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.posts.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'testimonials.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cart.updateItem': { paramsTuple?: []; params?: {} }
    'cart.update': { paramsTuple?: []; params?: {} }
    'orders.status.update': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'tracking.status.update': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'promo.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchant.products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'merchant.coupons.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'reviews.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'kyc.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.toggle': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.approve': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reviews.reject': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'kyc.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.posts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'testimonials.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cart.item.delete': { paramsTuple: [ParamValue]; params: {'itemId': ParamValue} }
    'cart.clear': { paramsTuple?: []; params?: {} }
    'promo.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'push.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchant.products.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.archived-products.permanent-delete': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.archived-products.restful.permanent-delete': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant.categories.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'merchant.coupons.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'reviews.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}