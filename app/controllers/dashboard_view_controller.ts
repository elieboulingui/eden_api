import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import Category from '#models/categories'
import Coupon from '#models/coupon'
import Product from '#models/Product'
import User from '#models/user'
import Database from '@ioc:Adonis/Lucid/Database'

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

const toNumber = (value: number | string | bigint | null | undefined) => Number(value ?? 0)

type CountRow = { total: number }

const shortAddress = (value: string | null | undefined) => {
  if (!value) {
    return 'Adresse inconnue'
  }
  return value.split(',')[0]
}

export default class DashboardViewController {
  public async admin({ view }: HttpContext) {
    const [
      totalUsersRows,
      merchantRows,
      totalOrdersRows,
      totalRevenueRows,
      productsRows,
      latestUsers,
    ] = await Promise.all([
      User.query().count('* as total') as unknown as CountRow[],
      User.query().whereIn('role', ['marchant', 'merchant']).count('* as total') as unknown as CountRow[],
      Order.query().count('* as total') as unknown as CountRow[],
      Order.query().sum('total as revenue') as unknown as Array<{ revenue: number }>,
      Product.query().count('* as total') as unknown as CountRow[],
      User.query().orderBy('created_at', 'desc').limit(6) as unknown as User[],
    ])

    const totalUsers = toNumber(totalUsersRows[0]?.total)
    const activeMerchants = toNumber(merchantRows[0]?.total)
    const totalOrders = toNumber(totalOrdersRows[0]?.total)
    const totalProducts = toNumber(productsRows[0]?.total)
    const totalRevenue = toNumber(totalRevenueRows[0]?.revenue)

    const adminStats = [
      {
        title: 'Utilisateurs inscrits',
        display: formatNumber(totalUsers),
        detail: 'Tous les rôles confondus',
      },
      {
        title: 'Marchands actifs',
        display: formatNumber(activeMerchants),
        detail: 'Boutiques vérifiées',
      },
      {
        title: 'Commandes suivies',
        display: formatNumber(totalOrders),
        detail: 'Données historiques',
      },
      {
        title: 'Chiffre d’affaires',
        display: formatMoney(totalRevenue),
        detail: 'Toutes les devises converties en FCFA',
      },
      {
        title: 'Produits référencés',
        display: formatNumber(totalProducts),
        detail: 'Offre catalogue',
      },
    ]

    const statusRows = (await Order.query()
      .select('status')
      .count('* as total')
      .groupBy('status')) as unknown as Array<{ status: string; total: number }>

    const statusBreakdown = statusRows.map((row) => {
      const meta = STATUS_META[row.status] ?? DEFAULT_STATUS_META
      const count = toNumber(row.total)
      const percent = totalOrders ? Math.min(100, Math.round((count / totalOrders) * 100)) : 0
      return {
        name: meta.label,
        value: count,
        percent,
        barClass: meta.barClass,
      }
    })

    const recentOrdersRaw = await Order.query().orderBy('created_at', 'desc').limit(6)
    const recentOrders = recentOrdersRaw.map((order) => {
      const meta = STATUS_META[order.status] ?? DEFAULT_STATUS_META
      return {
        number: order.order_number,
        customer: order.customer_name ?? order.customer_email ?? 'Client inconnu',
        total: formatMoney(order.total),
        statusLabel: meta.label,
        statusTone: meta.toneClass,
        createdAt: order.created_at?.toFormat('dd LLL yyyy') ?? 'Date inconnue',
        eta: order.estimated_delivery?.toFormat('dd LLL yyyy') ?? 'À planifier',
      }
    })

    const categoryCounts = (await Product.query()
      .select('category_id')
      .count('* as total')
      .whereNotNull('category_id')
      .groupBy('category_id')
      .orderBy('total', 'desc')
      .limit(4)) as unknown as Array<{ category_id: string | null; total: number }>

    const topCategories = await Promise.all(
      categoryCounts.map(async (row) => {
        const category = row.category_id ? await Category.find(row.category_id) : null

        return {
          name: category?.name ?? 'Catégorie non référencée',
          description: category?.description ?? 'sans description spécifique',
          products: formatNumber(toNumber(row.total)),
          statusTone: category?.is_active ? 'text-emerald-600' : 'text-slate-500',
          statusLabel: category?.is_active ? 'Active' : 'En pause',
        }
      })
    )

    const latestUserRows = latestUsers.map((user) => ({
      id: user.id,
      name: user.full_name ?? user.email,
      email: user.email,
      role: user.role,
      createdAt: user.created_at?.toFormat('dd LLL yyyy') ?? 'Date inconnue',
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

  public async secretary({ view }: HttpContext) {
    const now = DateTime.local()
    const startOfDay = now.startOf('day')
    const endOfDay = startOfDay.plus({ days: 1 })

    const [packagingRows, paymentRows, dailyDeliveryRows] = await Promise.all([
      Order.query()
        .whereIn('status', ['pending', 'processing'])
        .count('* as total') as unknown as CountRow[],
      Order.query()
        .whereIn('status', ['pending_payment', 'payment_failed'])
        .count('* as total') as unknown as CountRow[],
      Order.query()
        .whereNotNull('estimated_delivery')
        .where('estimated_delivery', '>=', startOfDay.toISO({ includeOffset: false }))
        .where('estimated_delivery', '<', endOfDay.toISO({ includeOffset: false }))
        .count('* as total') as unknown as CountRow[],
    ])

    const queueStats = [
      {
        title: 'Commandes à préparer',
        value: formatNumber(toNumber(packagingRows[0]?.total)),
        detail: 'Pending + en préparation',
      },
      {
        title: 'Livraisons prévues aujourd’hui',
        value: formatNumber(toNumber(dailyDeliveryRows[0]?.total)),
        detail: `Planifiées pour le ${startOfDay.toFormat('dd LLL yyyy')}`,
      },
      {
        title: 'Paiements à relancer',
        value: formatNumber(toNumber(paymentRows[0]?.total)),
        detail: 'Reliquat ou échec',
      },
    ]

    const followUpOrders = await Order.query()
      .whereIn('status', ['pending', 'pending_payment'])
      .orderBy('created_at', 'desc')
      .limit(6)

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
      .limit(4)

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

  public async manager({ view }: HttpContext) {
    const [
      preparing,
      blocked,
      delayed,
      shippingRegions,
      priorityOrders,
    ] = await Promise.all([
      Order.query()
        .whereIn('status', ['pending', 'processing'])
        .count('* as total') as unknown as CountRow[],
      Order.query()
        .where('status', 'processing')
        .count('* as total') as unknown as CountRow[],
      Order.query()
        .where('status', 'shipped')
        .where('estimated_delivery', '<', DateTime.local().minus({ hours: 1 }).toISO())
        .count('* as total') as unknown as CountRow[],
      Order.query()
        .select('shipping_carrier')
        .select(Database.rawQuery('count(*) as total'))
        .groupBy('shipping_carrier')
        .orderBy('total', 'desc')
        .limit(4)
        .catch(() => [] as Array<{ shipping_carrier: string | null; total: number }>),
      Order.query()
        .whereIn('status', ['pending', 'processing'])
        .orderBy('created_at', 'desc')
        .limit(5),
    ])

    const managerStats = [
      {
        title: 'Commandes en cours',
        value: formatNumber(toNumber(preparing[0]?.total)),
        detail: 'Payées + à préparer',
      },
      {
        title: 'Commandes bloquées',
        value: formatNumber(toNumber(blocked[0]?.total)),
        detail: 'Validation paiement interne',
      },
      {
        title: 'Livraisons retardées',
        value: formatNumber(toNumber(delayed[0]?.total)),
        detail: 'Destination prévue dépassée',
      },
    ]

    const regionRows = (shippingRegions as Array<{ shipping_carrier: string | null; total: number }>).map(
      (row) => ({
        carrier: row.shipping_carrier ?? 'Transporteur inconnu',
        total: formatNumber(row.total),
      })
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

  public async promotions({ view }: HttpContext) {
    const [coupons, redemptionRows] = await Promise.all([
      Coupon.query()
        .where('status', 'active')
        .orderBy('created_at', 'desc')
        .limit(8),
      Coupon.query()
        .select('type')
        .select(Database.rawQuery('count(*) as total'))
        .groupBy('type')
        .catch(() => [] as Array<{ type: string; total: number }>),
    ])

    const promoStats = [
      {
        title: 'Codes actifs',
        value: formatNumber(coupons.length),
        detail: 'À jour',
      },
      {
        title: 'Usage moyen',
        value: `${formatNumber(
      Math.round(
        coupons.reduce((acc: number, coupon: Coupon) => acc + (coupon.used_count ?? 0), 0) / Math.max(coupons.length, 1)
      )
        )} usages`,
        detail: 'par code',
      },
      {
        title: 'Valeur moyenne',
        value: formatMoney(
          Math.round(
          coupons.reduce((acc: number, coupon: Coupon) => acc + (coupon.discount ?? 0), 0) / Math.max(coupons.length, 1)
          )
        ),
        detail: 'de réduction',
      },
    ]

    const couponRows = coupons.map((coupon) => ({
      code: coupon.code,
      type: coupon.type,
      discount: coupon.discount,
      usage: coupon.used_count ?? 0,
      status: coupon.status,
    }))

    const redemptionStats = (redemptionRows as Array<{ type: string; total: number }>).map((row) => ({
      label: row.type,
      count: formatNumber(row.total),
    }))

    return view.render('pages/dashboards/promotions', {
      promoStats,
      couponRows,
      redemptionStats,
    })
  }
}
