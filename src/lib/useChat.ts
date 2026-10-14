import { useCallback, useEffect, useRef, useState } from 'react'
import { auth } from './firebase'
import type { ChatMessage } from './types'

export type ChatStatus = 'connecting' | 'open' | 'reconnecting' | 'denied'

type ServerFrame =
  | { type: 'history'; messages: ChatMessage[] }
  | { type: 'message'; message: ChatMessage }
  | { type: 'typing' }
  | { type: 'error'; message: string }

const MAX_BACKOFF_MS = 15_000

function wsUrl(elderId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/api/ws/${encodeURIComponent(elderId)}`
}

/** Live chat with the agent for one elder. Reconnects with backoff; stops on 4401/4403. */
export function useChat(elderId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('connecting')
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (elderId === null) return
    let alive = true
    let attempt = 0
    let timer: number | undefined

    const connect = () => {
      const ws = new WebSocket(wsUrl(elderId))
      wsRef.current = ws

      ws.onopen = async () => {
        const token = await auth.currentUser?.getIdToken()
        if (!alive || ws.readyState !== WebSocket.OPEN) return
        ws.send(JSON.stringify({ type: 'auth', token: token ?? '' }))
      }

      ws.onmessage = (ev: MessageEvent<string>) => {
        const frame = JSON.parse(ev.data) as ServerFrame
        switch (frame.type) {
          case 'history':
            attempt = 0
            setStatus('open')
            setMessages(frame.messages)
            break
          case 'message':
            setMessages((prev) => (prev.some((m) => m.id === frame.message.id) ? prev : [...prev, frame.message]))
            if (frame.message.sender === 'agent') setTyping(false)
            break
          case 'typing':
            setTyping(true)
            setError(null)
            break
          case 'error':
            setTyping(false)
            setError(frame.message)
            break
          default: {
            const exhaustive: never = frame
            return exhaustive
          }
        }
      }

      ws.onclose = (ev) => {
        if (!alive) return
        setTyping(false)
        if (ev.code === 4401 || ev.code === 4403) {
          setStatus('denied')
          return
        }
        setStatus('reconnecting')
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt)
        attempt += 1
        timer = window.setTimeout(connect, delay)
      }
    }

    connect()
    return () => {
      alive = false
      window.clearTimeout(timer)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [elderId])

  const send = useCallback((text: string): boolean => {
    const ws = wsRef.current
    const trimmed = text.trim()
    if (ws === null || ws.readyState !== WebSocket.OPEN || trimmed === '') return false
    ws.send(JSON.stringify({ type: 'message', text: trimmed }))
    setError(null)
    return true
  }, [])

  return { messages, status, typing, error, send }
}
