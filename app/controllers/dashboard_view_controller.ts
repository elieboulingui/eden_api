import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import Category from '#models/categories'
import Coupon from '#models/coupon'
import Product from '#models/Product'
import User from '#models/user'
import env from '#start/env'

const STATUS_META: Record<
  string,
  { label: string; barClass: string; toneClass: string }
> = {
  pending: { label: 'En attente', barClass: 'bg-amber-500', toneClass: 'text-amber-600' },
  processing: { label: 'En préparation', barClass: 'bg-sky-500', toneClass: 'text-sky-600' },
  shipped: { label: 'Expédiées', barClass: 'bg-cyan-500', toneClass: 'text-cyan-600' },
  delivered: { label: 'Livrées', barClass: 'bg-emerald-500', toneClass: 'text-emerald-600' },
  cancelled: { label: 'Annulées', barClass: 'bg-rose-500', toneClass: 'text-rose-600' },
  pending_payment: { label: 'Paiement en attente', barClass: 'bg-amber-700', toneClass: 'text-amber-700' },
  paid: { label: 'Paiement validé', barClass: 'bg-lime-500', toneClass: 'text-lime-600' },
  payment_failed: { label: 'Paiement refusé', barClass: 'bg-rose-600', toneClass: 'text-rose-600' },
}

const DEFAULT_STATUS_META = { label: 'Statut', barClass: 'bg-slate-500', toneClass: 'text-slate-500' }

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

const formatNumber = (value: number) => numberFormatter.format(Math.round(value ?? 0))

const formatMoney = (value: number) => `${numberFormatter.format(Math.round(value ?? 0))} FCFA`

const toNumber = (value: number | string | bigint | null | undefined) => {
  const num = Number(value ?? 0)
  return isNaN(num) ? 0 : num
}

type CountRow = { total: number }

const shortAddress = (value: string | null | undefined) => {
  if (!value) {
    return 'Adresse inconnue'
  }
  return value.split(',')[0]
}

// Fonction utilitaire pour les initiales
function getInitials(name: string): string {
  if (!name || name === 'Client inconnu') {
    return '👤'
  }

  const parts = name.trim().split(' ')

  if (parts.length === 1) {
    const firstTwo = parts[0].substring(0, 2).toUpperCase()
    return firstTwo.length === 2 ? firstTwo : '👤'
  }

  const firstInitial = parts[0][0]
  const lastInitial = parts[parts.length - 1][0]

  return (firstInitial + lastInitial).toUpperCase()
}

// Fonction pour récupérer une icône en fonction du statut
function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    processing: '🔧',
    shipped: '🚚',
    delivered: '✅',
    cancelled: '❌',
    pending_payment: '💳',
    paid: '💰',
    payment_failed: '⚠️',
  }
  return icons[status] || '📦'
}

export default class DashboardViewController {

  // ==================== ADMIN DASHBOARD ====================
  public async admin({ view }: HttpContext) {
    // Récupérer les compteurs utilisateurs
    const totalUsersCount = await User.query().count('* as total')
    const clientsCount = await User.query().where('role', 'client').count('* as total')
    const merchantsCount = await User.query().whereIn('role', ['marchant', 'merchant', 'marchand']).count('* as total')
    const totalProductsCount = await Product.query().count('* as total')

    // Extraire les valeurs utilisateurs
    const totalUsers = toNumber(totalUsersCount[0]?.$extras?.total)
    const totalClients = toNumber(clientsCount[0]?.$extras?.total)
    const activeMerchants = toNumber(merchantsCount[0]?.$extras?.total)
    const totalProducts = toNumber(totalProductsCount[0]?.$extras?.total)

    // Récupérer TOUTES les commandes pour calculer le total et les statuts
    const allOrders = await Order.query().select('status', 'total', 'id', 'order_number', 'customer_name', 'customer_email', 'created_at', 'estimated_delivery')

    // Calculer le total des commandes
    const totalOrders = allOrders.length

    // Calculer la répartition par statut
    const statusMap = new Map<string, number>()
    let totalRevenue = 0
    let totalPaidRevenue = 0

    for (const order of allOrders) {
      const count = statusMap.get(order.status) || 0
      statusMap.set(order.status, count + 1)

      // Chiffre d'affaires total
      totalRevenue += Number(order.total) || 0

      // Chiffre d'affaires des commandes payées
      if (['paid', 'delivered', 'processing', 'shipped'].includes(order.status)) {
        totalPaidRevenue += Number(order.total) || 0
      }
    }

    // Construire le breakdown des statuts
    const statusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => {
      const meta = STATUS_META[status] ?? DEFAULT_STATUS_META
      const percent = totalOrders > 0 ? Math.min(100, Math.round((count / totalOrders) * 100)) : 0
      const barColor = meta.barClass.replace('bg-', '#')
      return {
        name: meta.label,
        value: count,
        percent,
        borderColor: barColor,
        badgeColor: barColor,
        barBg: '#fef3c7',
        progressStart: barColor,
        progressEnd: barColor,
        detailColor: '#713f12',
        icon: getStatusIcon(status),
      }
    })

    // Trier les statuts par ordre décroissant de valeur
    statusBreakdown.sort((a, b) => b.value - a.value)

    console.log('=== DEBUG ADMIN DASHBOARD ===')
    console.log('totalUsers:', totalUsers)
    console.log('totalClients:', totalClients)
    console.log('activeMerchants:', activeMerchants)
    console.log('totalOrders:', totalOrders)
    console.log('totalProducts:', totalProducts)
    console.log('totalRevenue:', totalRevenue)
    console.log('totalPaidRevenue:', totalPaidRevenue)

    const adminStats = [
      { title: 'Utilisateurs inscrits', display: formatNumber(totalUsers), detail: 'Tous les rôles confondus', icon: '👥' },
      { title: 'Clients', display: formatNumber(totalClients), detail: 'Comptes clients', icon: '👤' },
      { title: 'Marchands', display: formatNumber(activeMerchants), detail: 'Boutiques', icon: '🏪' },
      { title: 'Commandes', display: formatNumber(totalOrders), detail: 'Commandes passées', icon: '📦' },
      { title: 'Chiffre d’affaires', display: formatMoney(totalPaidRevenue > 0 ? totalPaidRevenue : totalRevenue), detail: 'Commandes payées uniquement', icon: '💰' },
      { title: 'Produits', display: formatNumber(totalProducts), detail: 'Catalogue', icon: '📚' },
    ]

    // Dernières commandes (10 dernières)
    const recentOrdersRaw = allOrders.slice(0, 10)
    const recentOrders = recentOrdersRaw.map((order) => {
      const meta = STATUS_META[order.status] ?? DEFAULT_STATUS_META
      const barColor = meta.barClass.replace('bg-', '#')
      return {
        id: order.id,
        number: order.order_number,
        customer: order.customer_name ?? order.customer_email ?? 'Client inconnu',
        total: formatMoney(order.total),
        statusLabel: meta.label,
        status: order.status,
        statusColor: barColor,
        createdAt: order.created_at?.toFormat('dd LLL yyyy') ?? 'Date inconnue',
        eta: order.estimated_delivery?.toFormat('dd LLL yyyy') ?? 'À planifier',
      }
    })

    // Catégories populaires
    const categoryCounts = (await Product.query()
      .select('category_id')
      .count('* as total')
      .whereNotNull('category_id')
      .groupBy('category_id')
      .orderBy('total', 'desc')
      .limit(8)) as unknown as Array<{ category_id: string | null; $extras: { total: string } }>

    const topCategories = await Promise.all(
      categoryCounts.map(async (row) => {
        const category = row.category_id ? await Category.find(row.category_id) : null
        const productCount = toNumber(row.$extras?.total)
        return {
          name: category?.name ?? 'Catégorie non référencée',
          description: category?.description ?? 'sans description spécifique',
          products: formatNumber(productCount),
          statusLabel: category?.is_active ? 'Active' : 'En pause',
          icon: '📦',
          titleColor: '#166534',
          descColor: '#14532d',
          badgeColor: '#dcfce7',
          badgeTextColor: '#166534',
        }
      })
    )

    // Derniers utilisateurs
    const latestUsers = await User.query().orderBy('created_at', 'desc').limit(10)

    const latestUserRows = latestUsers.map((user) => ({
      id: user.id,
      name: user.full_name ?? user.email,
      email: user.email,
      role: user.role,
      createdAt: user.created_at?.toFormat('dd LLL yyyy') ?? 'Date inconnue',
      initials: getInitials(user.full_name ?? user.email),
    }))

    return view.render('pages/dashboards/admin', {
      adminStats,
      statusBreakdown,
      recentOrders,
      topCategories,
      totalOrders,
      latestUsers: latestUserRows,
    })
  }

  // ==================== SECRETARY DASHBOARD ====================
  public async secretary({ view }: HttpContext) {
    const now = DateTime.local()
    const startOfDay = now.startOf('day')
    const endOfDay = startOfDay.plus({ days: 1 })

    const [packagingRows, paymentRows, dailyDeliveryRows] = await Promise.all([
      Order.query().whereIn('status', ['pending', 'processing']).count('* as total') as unknown as CountRow[],
      Order.query().whereIn('status', ['pending_payment', 'payment_failed']).count('* as total') as unknown as CountRow[],
      Order.query()
        .whereNotNull('estimated_delivery')
        .where('estimated_delivery', '>=', startOfDay.toISO({ includeOffset: false }))
        .where('estimated_delivery', '<', endOfDay.toISO({ includeOffset: false }))
        .count('* as total') as unknown as CountRow[],
    ])

    const queueStats = [
      { title: 'Commandes à préparer', value: formatNumber(toNumber(packagingRows[0]?.total)), detail: 'Pending + en préparation' },
      { title: 'Livraisons prévues aujourd’hui', value: formatNumber(toNumber(dailyDeliveryRows[0]?.total)), detail: `Planifiées pour le ${startOfDay.toFormat('dd LLL yyyy')}` },
      { title: 'Paiements à relancer', value: formatNumber(toNumber(paymentRows[0]?.total)), detail: 'Reliquat ou échec' },
    ]

    const followUpOrders = await Order.query().whereIn('status', ['pending', 'pending_payment']).orderBy('created_at', 'desc').limit(20)
    const followUps = followUpOrders.map((order) => {
      const meta = STATUS_META[order.status] ?? DEFAULT_STATUS_META
      return {
        number: order.order_number,
        customer: order.customer_name ?? order.customer_email ?? 'Client inconnu',
        statusLabel: meta.label,
        statusTone: meta.toneClass,
        due: order.estimated_delivery?.toFormat('dd LLL') ?? 'Pas de date',
        remark: order.admin_notes ?? 'Vérifier le paiement ou la disponibilité',
        total: formatMoney(order.total),
      }
    })

    const upcomingDeliveriesRaw = await Order.query()
      .whereNotNull('estimated_delivery')
      .whereNotNull('shipping_carrier')
      .where('status', '!=', 'cancelled')
      .orderBy('estimated_delivery', 'asc')
      .limit(20)

    const upcomingDeliveries = upcomingDeliveriesRaw.map((order) => ({
      number: order.order_number,
      carrier: order.shipping_carrier ?? 'Transport non précisé',
      eta: order.estimated_delivery?.toFormat('dd LLL HH:mm') ?? 'À confirmer',
      status: (STATUS_META[order.status] ?? DEFAULT_STATUS_META).label,
      destination: shortAddress(order.shipping_address),
    }))

    return view.render('pages/dashboards/secretary', {
      queueStats,
      followUps,
      upcomingDeliveries,
      todayLabel: startOfDay.toFormat('dd LLL yyyy'),
    })
  }

  // ==================== MANAGER DASHBOARD ====================
  public async manager({ view }: HttpContext) {
    const [
      preparing,
      blocked,
      delayed,
      shippingRegions,
      priorityOrders,
    ] = await Promise.all([
      Order.query().whereIn('status', ['pending', 'processing']).count('* as total') as unknown as CountRow[],
      Order.query().where('status', 'processing').count('* as total') as unknown as CountRow[],
      Order.query()
        .where('status', 'shipped')
        .where('estimated_delivery', '<', DateTime.local().minus({ hours: 1 }).toISO())
        .count('* as total') as unknown as CountRow[],
      Order.query()
        .select('shipping_carrier')
        .count('id as total')
        .groupBy('shipping_carrier')
        .orderBy('total', 'desc')
        .catch(() => [] as Array<{ shipping_carrier: string | null; total: number }>),
      Order.query().whereIn('status', ['pending', 'processing']).orderBy('created_at', 'desc').limit(10),
    ])

    const managerStats = [
      { title: 'Commandes en cours', value: formatNumber(toNumber(preparing[0]?.total)), detail: 'Payées + à préparer' },
      { title: 'Commandes bloquées', value: formatNumber(toNumber(blocked[0]?.total)), detail: 'Validation paiement interne' },
      { title: 'Livraisons retardées', value: formatNumber(toNumber(delayed[0]?.total)), detail: 'Destination prévue dépassée' },
    ]

    const regionRows = (shippingRegions as Array<{ shipping_carrier: string | null; total: number }>).map(
      (row) => ({ carrier: row.shipping_carrier ?? 'Transporteur inconnu', total: formatNumber(row.total) })
    )

    const priorityRows = (priorityOrders as unknown as Order[]).map((order) => ({
      number: order.order_number,
      status: (STATUS_META[order.status] ?? DEFAULT_STATUS_META).label,
      total: formatMoney(order.total),
      customer: order.customer_name ?? order.customer_email ?? 'Client inconnu',
    }))

    return view.render('pages/dashboards/manager', {
      managerStats,
      regionRows,
      priorityRows,
      timestamp: DateTime.local().toFormat('dd LLL yyyy HH:mm'),
    })
  }

  // ==================== SHOPS DASHBOARD ====================
  public async shops({ view }: HttpContext) {
    try {
      // Test 1 : Récupérer TOUS les utilisateurs
      const allUsers = await User.all()
      console.log('Tous les utilisateurs:', allUsers.length)

      // Test 2 : Récupérer les marchands
      const merchants = await User.query()
        .where('role', 'marchant')
        .orWhere('role', 'merchant')
        .orWhere('role', 'marchand')

      console.log('Marchands trouvés:', merchants.length)
      console.log('Rôles trouvés:', merchants.map(m => m.role))

      // Test 3 : Récupérer un marchand avec ses produits
      if (merchants.length > 0) {
        const firstMerchant = merchants[0]
        await firstMerchant.load('products')
        console.log('Produits du premier marchand:', firstMerchant.products.length)
      }

      // Test 4 : Compter tous les produits
      const allProducts = await Product.query().where('is_archived', false)
      console.log('Tous les produits non archivés:', allProducts.length)

      const totalMerchants = merchants.length
      const verifiedMerchants = merchants.filter(m => m.is_verified === true).length
      const pendingMerchants = merchants.filter(m => m.is_verified !== true).length
      const totalProducts = allProducts.length

      const formattedMerchants = merchants.map((merchant) => ({
        id: merchant.id,
        full_name: merchant.full_name || merchant.email,
        email: merchant.email,
        shop_name: merchant.shop_name || merchant.commercial_name || merchant.full_name || 'Boutique',
        phone: merchant.phone || 'Non renseigné',
        logo_url: merchant.logo_url || null,
        is_verified: merchant.is_verified ?? false,
        verification_status: merchant.verification_status || 'pending',
        products_count: 0,
        created_at: merchant.created_at?.toFormat('dd/MM/yyyy') || 'Date inconnue',
      }))

      return view.render('pages/dashboards/secretary', {
        merchants: formattedMerchants,
        totalMerchants,
        verifiedMerchants,
        pendingMerchants,
        totalProducts,
      })
    } catch (error) {
      console.error('❌ ERREUR COMPLÈTE:', error)
      return view.render('pages/dashboards/secretary', {
        merchants: [],
        totalMerchants: 0,
        verifiedMerchants: 0,
        pendingMerchants: 0,
        totalProducts: 0,
      })
    }
  }

  // ==================== PROMOTIONS DASHBOARD ====================
  public async promotions({ view }: HttpContext) {
    const [
      coupons,
      couponUsages,
      topUsers,
    ] = await Promise.all([
      Coupon.query().where('status', 'active').orderBy('created_at', 'desc'),
      Order.query().whereNotNull('coupon_id').orderBy('created_at', 'desc').limit(50).preload('user').preload('items', (query) => { query.preload('product') }),
      Order.query().whereNotNull('coupon_id').select('user_id').count('id as total_uses').groupBy('user_id').orderBy('total_uses', 'desc').limit(10).preload('user'),
    ])

    const couponMap = new Map()
    for (const coupon of coupons) { couponMap.set(coupon.id, coupon) }

    const totalCoupons = coupons.length
    const totalUsed = coupons.reduce((acc, coupon) => acc + (coupon.used_count ?? 0), 0)
    const averageUsage = totalCoupons > 0 ? Math.round(totalUsed / totalCoupons) : 0
    const averageDiscount = totalCoupons > 0 ? Math.round(coupons.reduce((acc, coupon) => acc + (coupon.discount ?? 0), 0) / totalCoupons) : 0

    const promoStats = [
      { title: 'Codes actifs', value: formatNumber(totalCoupons), detail: 'À jour', icon: '🎟️' },
      { title: 'Utilisations totales', value: formatNumber(totalUsed), detail: 'codes utilisés', icon: '📊' },
      { title: 'Usage moyen', value: `${formatNumber(averageUsage)} usages`, detail: 'par code', icon: '⚡' },
      { title: 'Valeur moyenne', value: formatMoney(averageDiscount), detail: 'de réduction', icon: '💰' },
    ]

    const couponRows = coupons.map((coupon) => ({
      code: coupon.code,
      type: coupon.type === 'percentage' ? 'Pourcentage' : 'Montant fixe',
      discount: coupon.type === 'percentage' ? `${coupon.discount}%` : formatMoney(coupon.discount ?? 0),
      usage_count: coupon.used_count ?? 0,
      max_uses: (coupon as any).max_uses ?? null,
      status: coupon.status,
      created_at: coupon.created_at?.toFormat('dd LLL yyyy') ?? 'Date inconnue',
      expires_at: (coupon as any).expires_at?.toFormat('dd LLL yyyy') ?? 'Jamais',
    }))

    const couponUsagesList = []
    for (const order of couponUsages as any[]) {
      const coupon = couponMap.get(order.coupon_id)
      if (coupon) {
        let discountAmount = 0
        if (coupon.type === 'percentage') { discountAmount = (order.total * (coupon.discount ?? 0)) / 100 }
        else { discountAmount = coupon.discount ?? 0 }

        for (const item of order.items || []) {
          if (item.product) {
            couponUsagesList.push({
              used_at: order.created_at?.toFormat('dd/MM/yyyy HH:mm') ?? 'Date inconnue',
              user_name: order.user?.full_name ?? order.customer_name ?? 'Client inconnu',
              user_email: order.user?.email ?? order.customer_email ?? 'Email inconnu',
              user_initials: getInitials(order.user?.full_name ?? order.customer_name ?? 'Client'),
              coupon_code: coupon.code,
              product_name: item.product.name ?? 'Produit inconnu',
              product_category: item.product.category?.name ?? 'Non catégorisé',
              discount_amount: formatMoney(discountAmount),
              order_total: formatMoney(order.total),
            })
            break
          }
        }
      }
    }

    const redemptionStats = coupons.map((coupon) => {
      const usedCount = coupon.used_count ?? 0
      const maxUses = (coupon as any).max_uses ?? 0
      return {
        coupon_code: coupon.code,
        type: coupon.type === 'percentage' ? 'Pourcentage' : 'Montant fixe',
        discount: coupon.type === 'percentage' ? `${coupon.discount}%` : formatMoney(coupon.discount ?? 0),
        count: usedCount,
        remaining: maxUses > 0 ? Math.max(0, maxUses - usedCount) : 'Illimité',
        usage_percent: maxUses > 0 ? Math.min(100, Math.round((usedCount / maxUses) * 100)) : Math.min(100, Math.round((usedCount / 100) * 100)),
      }
    })

    const topCouponUsers = []
    for (const row of topUsers as any[]) {
      if (row.user) {
        topCouponUsers.push({
          name: row.user.full_name ?? row.user.email,
          email: row.user.email,
          initials: getInitials(row.user.full_name ?? row.user.email),
          coupons_used: Number(row.$extras.total_uses ?? 0),
          total_saved: formatMoney(0),
          last_product: 'Aucun achat',
        })
      }
    }

    return view.render('pages/dashboards/promotions', {
      promoStats,
      couponRows,
      redemptionStats,
      couponUsages: couponUsagesList.slice(0, 50),
      topCouponUsers,
    })
  }

  // ==================== REFUND DASHBOARD ====================
  public async refund({ view }: HttpContext) {
    try {
      const [
        totalRefunds,
        pendingRefunds,
        approvedRefunds,
        completedRefunds,
        recentRefunds
      ] = await Promise.all([
        Order.query().where('status', 'refunded').count('* as total'),
        Order.query().where('status', 'refund_requested').count('* as total'),
        Order.query().where('status', 'refund_approved').count('* as total'),
        Order.query().where('status', 'refund_completed').count('* as total'),
        Order.query()
          .whereIn('status', ['refund_requested', 'refund_approved', 'refunded'])
          .orderBy('created_at', 'desc')
          .limit(10)
          .preload('user')
      ])

      const refundStats = [
        {
          title: 'Total des remboursements',
          value: formatNumber(toNumber((totalRefunds as any)[0]?.$extras?.total || 0)),
          detail: 'Tous statuts confondus',
          icon: '💰'
        },
        {
          title: 'Remboursements en attente',
          value: formatNumber(toNumber((pendingRefunds as any)[0]?.$extras?.total || 0)),
          detail: 'À traiter',
          icon: '⏳'
        },
        {
          title: 'Remboursements approuvés',
          value: formatNumber(toNumber((approvedRefunds as any)[0]?.$extras?.total || 0)),
          detail: 'En cours de traitement',
          icon: '✅'
        },
        {
          title: 'Remboursements complétés',
          value: formatNumber(toNumber((completedRefunds as any)[0]?.$extras?.total || 0)),
          detail: 'Terminés',
          icon: '🎉'
        },
      ]

      const recentRefundRequests = (recentRefunds as Order[]).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        customer: order.customer_name ?? order.user?.full_name ?? 'Client inconnu',
        total: formatMoney(order.total),
        status: order.status,
        statusLabel: this.getRefundStatusLabel(order.status),
        statusColor: this.getRefundStatusColor(order.status),
        requested_at: order.created_at?.toFormat('dd LLL yyyy HH:mm') ?? 'Date inconnue',
      }))

      return view.render('pages/dashboards/refund', {
        refundStats,
        recentRefunds: recentRefundRequests,
        totalRefunds: toNumber((totalRefunds as any)[0]?.$extras?.total || 0)
      })
    } catch (error) {
      console.error('Error loading refund dashboard:', error)
      return view.render('pages/dashboards/refund', {
        refundStats: [
          { title: 'Total remboursements', value: '0', detail: 'Aucune donnée', icon: '💰' },
          { title: 'En attente', value: '0', detail: 'Aucune donnée', icon: '⏳' },
          { title: 'Approuvés', value: '0', detail: 'Aucune donnée', icon: '✅' },
          { title: 'Complétés', value: '0', detail: 'Aucune donnée', icon: '🎉' },
        ],
        recentRefunds: [],
        totalRefunds: 0
      })
    }
  }

  // ==================== REFUND DETAILS DASHBOARD ====================
  public async refundDetails({ view, params, response }: HttpContext) {
    try {
      const orderId = params.id

      const order = await Order.query()
        .where('id', orderId)
        .preload('user')
        .preload('items', (query) => {
          query.preload('product')
        })
        .first()

      if (!order) {
        return response.status(404).send('Commande non trouvée')
      }

      const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      const tax = (order as any).tax_amount || 0
      const shipping = order.shipping_cost || 0
      const discount = order.discount_amount || 0
      const total = order.total || 0

      const refundInfo = {
        is_refundable: this.isOrderRefundable(order),
        refund_status: (order as any).refund_status || 'not_requested',
        refund_amount: (order as any).refund_amount || 0,
        refund_reason: (order as any).refund_reason || null,
        refund_requested_at: (order as any).refund_requested_at,
        refund_approved_at: (order as any).refund_approved_at,
        refund_completed_at: (order as any).refund_completed_at,
        refund_rejection_reason: (order as any).refund_rejection_reason || null
      }

      const customerDetails = {
        name: order.user?.full_name || order.customer_name || 'Client inconnu',
        email: order.user?.email || order.customer_email || 'Email inconnu',
        phone: order.user?.phone || order.customer_phone || 'Non renseigné',
        address: order.shipping_address || 'Adresse non renseignée'
      }

      const deliveryDetails = {
        carrier: order.shipping_carrier || 'Non spécifié',
        tracking_number: order.tracking_number || 'Non disponible',
        estimated_delivery: order.estimated_delivery?.toFormat('dd LLL yyyy HH:mm') || 'Non planifiée',
        actual_delivery: (order as any).actual_delivery?.toFormat('dd LLL yyyy HH:mm') || 'Non livrée'
      }

      const statusHistory = (order as any).status_history || []
      const refundEligibility = this.checkRefundEligibility(order)

      return view.render('pages/dashboards/refund-details', {
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          statusLabel: STATUS_META[order.status]?.label || 'Statut inconnu',
          statusColor: STATUS_META[order.status]?.barClass?.replace('bg-', '#') || '#6b7280',
          created_at: order.created_at?.toFormat('dd LLL yyyy HH:mm') ?? 'Date inconnue',
          updated_at: order.updated_at?.toFormat('dd LLL yyyy HH:mm') ?? 'Date inconnue'
        },
        customer: customerDetails,
        items: order.items.map(item => ({
          id: item.id,
          product_name: item.product?.name || 'Produit inconnu',
          product_image: item.product?.image_url || '/default-product.jpg',
          quantity: item.quantity,
          price: formatMoney(item.price),
          total: formatMoney(item.price * item.quantity)
        })),
        totals: {
          subtotal: formatMoney(subtotal),
          tax: formatMoney(tax),
          shipping: formatMoney(shipping),
          discount: formatMoney(discount),
          total: formatMoney(total)
        },
        delivery: deliveryDetails,
        refund: refundInfo,
        eligibility: refundEligibility,
        statusHistory: statusHistory
      })
    } catch (error) {
      console.error('Error loading refund details:', error)
      return response.status(500).send('Erreur lors du chargement des détails du remboursement')
    }
  }

  // ==================== PAYPAL DASHBOARD ====================
  public async paypal({ view }: HttpContext) {
    try {
      // Récupérer les transactions PayPal récentes
      const paypalOrders = await Order.query()
        .where('payment_method', 'paypal')
        .orderBy('created_at', 'desc')
        .limit(20)
        .preload('user')

      const totalPaypalPayments = await Order.query()
        .where('payment_method', 'paypal')
        .where('payment_status', 'completed')
        .sum('total as total')

      const totalPaypalAmount = totalPaypalPayments[0]?.$extras?.total || 0

      const paypalStats = [
        {
          title: 'Transactions PayPal',
          value: formatNumber(paypalOrders.length),
          detail: 'Nombre total de transactions',
          icon: '💳'
        },
        {
          title: 'Montant total',
          value: formatMoney(Number(totalPaypalAmount)),
          detail: 'Chiffre d\'affaires PayPal',
          icon: '💰'
        },
        {
          title: 'Taux de conversion',
          value: '98%',
          detail: 'Paiements réussis',
          icon: '📊'
        }
      ]

      const recentPaypalTransactions = paypalOrders.map((order) => ({
        id: order.id,
        order_number: order.order_number,
        customer: order.user?.full_name || order.customer_name || 'Client inconnu',
        amount: formatMoney(order.total),
        status: order.payment_status,
        paypal_order_id: (order as any).paypal_order_id,
        created_at: order.created_at?.toFormat('dd LLL yyyy HH:mm') ?? 'Date inconnue'
      }))

      return view.render('pages/dashboards/paypal', {
        paypalStats,
        recentTransactions: recentPaypalTransactions,
        totalTransactions: paypalOrders.length,
        clientId: env.get('PAYPAL_CLIENT_ID')
      })
    } catch (error) {
      console.error('Error loading PayPal dashboard:', error)
      return view.render('pages/dashboards/paypal', {
        paypalStats: [
          { title: 'Transactions PayPal', value: '0', detail: 'Aucune transaction', icon: '💳' },
          { title: 'Montant total', value: '0 FCFA', detail: 'Aucun montant', icon: '💰' },
          { title: 'Taux de conversion', value: '0%', detail: 'Aucune donnée', icon: '📊' },
        ],
        recentTransactions: [],
        totalTransactions: 0,
        clientId: env.get('PAYPAL_CLIENT_ID')
      })
    }
  }

  // ==================== HELPER METHODS ====================

  private getRefundStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'refund_requested': 'Demande en cours',
      'refund_approved': 'Approuvé',
      'refund_rejected': 'Rejeté',
      'refunded': 'Remboursé',
      'refund_completed': 'Terminé',
      'refund_processing': 'En traitement'
    }
    return labels[status] || 'Statut inconnu'
  }

  private getRefundStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'refund_requested': '#f59e0b',
      'refund_approved': '#10b981',
      'refund_rejected': '#ef4444',
      'refunded': '#3b82f6',
      'refund_completed': '#059669',
      'refund_processing': '#8b5cf6'
    }
    return colors[status] || '#6b7280'
  }

  private isOrderRefundable(order: Order): boolean {
    const refundableStatuses = ['delivered', 'shipped', 'paid']
    const nonRefundableStatuses = ['cancelled', 'refunded', 'refund_completed']

    if (nonRefundableStatuses.includes(order.status)) {
      return false
    }

    const orderDate = order.created_at
    const now = DateTime.local()
    const daysSinceOrder = orderDate ? now.diff(orderDate, 'days').days : 31

    if (daysSinceOrder > 30) {
      return false
    }

    return refundableStatuses.includes(order.status)
  }

  private checkRefundEligibility(order: Order): {
    eligible: boolean;
    reasons: Array<{ condition: boolean; message: string }>;
  } {
    const reasons = []

    const isStatusValid = ['delivered', 'shipped', 'paid'].includes(order.status)
    reasons.push({
      condition: isStatusValid,
      message: `Le statut de la commande doit être "Livrée", "Expédiée" ou "Payée" (actuel: ${STATUS_META[order.status]?.label || order.status})`
    })

    const isNotRefunded = !['refunded', 'refund_completed'].includes(order.status)
    reasons.push({
      condition: isNotRefunded,
      message: 'La commande n\'a pas déjà été remboursée'
    })

    const orderDate = order.created_at
    const now = DateTime.local()
    const daysSinceOrder = orderDate ? now.diff(orderDate, 'days').days : 31
    const isWithin30Days = daysSinceOrder <= 30
    reasons.push({
      condition: isWithin30Days,
      message: `La commande doit dater de moins de 30 jours (${Math.floor(daysSinceOrder)} jours)`
    })

    const eligible = reasons.every(r => r.condition)

    return { eligible, reasons }
  }
}
