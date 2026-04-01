/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
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
