/**
 * WebSocket connection manager.
 * Handles connection lifecycle, auto-reconnect, and message routing.
 */
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export class WSClient {
  constructor(path, handlers = {}) {
    this.url = `${WS_BASE}${path}`
    this.handlers = handlers
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnects = 5
    this.reconnectDelay = 2000
    this.shouldReconnect = true
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.handlers.onOpen?.()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handlers.onMessage?.(data)
        } catch (e) {
          console.error('WS parse error:', e)
        }
      }

      this.ws.onclose = (event) => {
        this.handlers.onClose?.(event)
        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnects) {
          this.reconnectAttempts++
          setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts)
        }
      }

      this.ws.onerror = (error) => {
        this.handlers.onError?.(error)
      }
    } catch (e) {
      console.error('WS connection error:', e)
    }
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data))
      return true
    }
    return false
  }

  close() {
    this.shouldReconnect = false
    this.ws?.close()
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export default WSClient
