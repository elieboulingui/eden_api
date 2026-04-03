/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'orders.check_payment_status': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:orderId/payment-status',
    tokens: [{"old":"/api/orders/:orderId/payment-status","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/payment-status","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/payment-status","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/payment-status","type":0,"val":"payment-status","end":""}],
    types: placeholder as Registry['orders.check_payment_status']['types'],
  },
  'orders.payment_status_callbacks': {
    methods: ["GET","HEAD"],
    pattern: '/api/payment/status/:transactionId',
    tokens: [{"old":"/api/payment/status/:transactionId","type":0,"val":"api","end":""},{"old":"/api/payment/status/:transactionId","type":0,"val":"payment","end":""},{"old":"/api/payment/status/:transactionId","type":0,"val":"status","end":""},{"old":"/api/payment/status/:transactionId","type":1,"val":"transactionId","end":""}],
    types: placeholder as Registry['orders.payment_status_callbacks']['types'],
  },
  'pubs.get_all_pubs': {
    methods: ["GET","HEAD"],
    pattern: '/api/pubs',
    tokens: [{"old":"/api/pubs","type":0,"val":"api","end":""},{"old":"/api/pubs","type":0,"val":"pubs","end":""}],
    types: placeholder as Registry['pubs.get_all_pubs']['types'],
  },
  'pubs.create_pub': {
    methods: ["POST"],
    pattern: '/api/pubs',
    tokens: [{"old":"/api/pubs","type":0,"val":"api","end":""},{"old":"/api/pubs","type":0,"val":"pubs","end":""}],
    types: placeholder as Registry['pubs.create_pub']['types'],
  },
  'pubs.update_pub': {
    methods: ["PUT"],
    pattern: '/api/pubs/:id',
    tokens: [{"old":"/api/pubs/:id","type":0,"val":"api","end":""},{"old":"/api/pubs/:id","type":0,"val":"pubs","end":""},{"old":"/api/pubs/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['pubs.update_pub']['types'],
  },
  'pubs.delete_pub': {
    methods: ["DELETE"],
    pattern: '/api/pubs/:id',
    tokens: [{"old":"/api/pubs/:id","type":0,"val":"api","end":""},{"old":"/api/pubs/:id","type":0,"val":"pubs","end":""},{"old":"/api/pubs/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['pubs.delete_pub']['types'],
  },
  'pubs.toggle_pub_status': {
    methods: ["PATCH"],
    pattern: '/api/pubs/:id/toggle',
    tokens: [{"old":"/api/pubs/:id/toggle","type":0,"val":"api","end":""},{"old":"/api/pubs/:id/toggle","type":0,"val":"pubs","end":""},{"old":"/api/pubs/:id/toggle","type":1,"val":"id","end":""},{"old":"/api/pubs/:id/toggle","type":0,"val":"toggle","end":""}],
    types: placeholder as Registry['pubs.toggle_pub_status']['types'],
  },
  'orders.store': {
    methods: ["POST"],
    pattern: '/api/orders',
    tokens: [{"old":"/api/orders","type":0,"val":"api","end":""},{"old":"/api/orders","type":0,"val":"orders","end":""}],
    types: placeholder as Registry['orders.store']['types'],
  },
  'orders.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:userId',
    tokens: [{"old":"/api/orders/:userId","type":0,"val":"api","end":""},{"old":"/api/orders/:userId","type":0,"val":"orders","end":""},{"old":"/api/orders/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['orders.index']['types'],
  },
  'orders.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:orderId/user/:userId',
    tokens: [{"old":"/api/orders/:orderId/user/:userId","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/user/:userId","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/user/:userId","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/user/:userId","type":0,"val":"user","end":""},{"old":"/api/orders/:orderId/user/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['orders.show']['types'],
  },
  'orders.cancel': {
    methods: ["POST"],
    pattern: '/api/orders/:orderId/cancel',
    tokens: [{"old":"/api/orders/:orderId/cancel","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/cancel","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/cancel","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/cancel","type":0,"val":"cancel","end":""}],
    types: placeholder as Registry['orders.cancel']['types'],
  },
  'orders.invoice': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:orderId/invoice/:userId',
    tokens: [{"old":"/api/orders/:orderId/invoice/:userId","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":0,"val":"invoice","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['orders.invoice']['types'],
  },
  'orders.update_status': {
    methods: ["PUT"],
    pattern: '/api/orders/:orderId/status',
    tokens: [{"old":"/api/orders/:orderId/status","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/status","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/status","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['orders.update_status']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
