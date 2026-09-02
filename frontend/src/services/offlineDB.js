/**
 * Offline event queue using IndexedDB.
 * Caches detection events when network is unavailable,
 * automatically syncs when connectivity resumes.
 */
import { openDB } from 'idb'
import { syncOfflineEvents } from './api'

const DB_NAME = 'roadrepair-offline'
const STORE_NAME = 'pending-events'
const DB_VERSION = 1

let db = null

async function getDB() {
  if (db) return db
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
  })
  return db
}

export async function addOfflineEvent(event) {
  const database = await getDB()
  await database.add(STORE_NAME, {
    ...event,
    queued_at: new Date().toISOString(),
  })
}

export async function getPendingCount() {
  const database = await getDB()
  return await database.count(STORE_NAME)
}

export async function getAllPending() {
  const database = await getDB()
  return await database.getAll(STORE_NAME)
}

export async function clearPending() {
  const database = await getDB()
  await database.clear(STORE_NAME)
}

export async function syncPendingEvents() {
  const pending = await getAllPending()
  if (pending.length === 0) return { synced: 0 }

  try {
    const eventsToSync = pending.map(({ id, queued_at, ...event }) => event)
    const response = await syncOfflineEvents(eventsToSync)
    await clearPending()
    return response.data
  } catch (error) {
    console.error('Failed to sync offline events:', error)
    throw error
  }
}

// Auto-sync on reconnect
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    try {
      const count = await getPendingCount()
      if (count > 0) {
        console.log(`Network back online. Syncing ${count} cached events...`)
        await syncPendingEvents()
        console.log('Offline events synced successfully')
      }
    } catch (e) {
      console.error('Auto-sync failed:', e)
    }
  })
}
