import { useCallback, useEffect, useRef, useState } from 'react'
import { auth } from './firebase'
import { API_BASE } from './api'
import type { ActionCard, ChatMessage, FamilyMessage, Mood, TodayCheckIn } from './types'

export type ChatStatus = 'connecting' | 'open' | 'reconnecting' | 'denied'

type ServerFrame =
  | { type: 'history'; messages: ChatMessage[] }
  | { type: 'message'; message: ChatMessage }
  | { type: 'typing' }
  | { type: 'checkin'; checkin: TodayCheckIn | null }
  | { type: 'action_update'; messageId: string; action: ActionCard }
  | { type: 'family_history'; messages: FamilyMessage[] }
  | { type: 'family_message'; message: FamilyMessage }
  | { type: 'family_update'; message: FamilyMessage }
  | { type: 'error'; message: string }

const MAX_BACKOFF_MS = 15_000

function wsUrl(elderId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  if (API_BASE.startsWith('http')) return `${API_BASE.replace(/^http/, 'ws')}/ws/${encodeURIComponent(elderId)}`
  return `${proto}://${window.location.host}${API_BASE}/ws/${encodeURIComponent(elderId)}`
}

/** Live chat with the agent for one elder. Reconnects with backoff; stops on 4401/4403. */
export function useChat(elderId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [family, setFamily] = useState<FamilyMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('connecting')
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // undefined = not received yet; null = check-ins not set up (no assessment)
  const [checkin, setCheckin] = useState<TodayCheckIn | null | undefined>(undefined)
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
            setMessages(frame.messages)
            break
          case 'family_history':
            // Sent to elders and caretakers alike, after `history` — so it marks the socket ready.
            attempt = 0
            setStatus('open')
            setFamily(frame.messages)
            break
          case 'family_message':
            setFamily((prev) => (prev.some((m) => m.id === frame.message.id) ? prev : [...prev, frame.message]))
            break
          case 'family_update':
            setFamily((prev) => prev.map((m) => (m.id === frame.message.id ? frame.message : m)))
            break
          case 'message':
            setMessages((prev) => (prev.some((m) => m.id === frame.message.id) ? prev : [...prev, frame.message]))
            if (frame.message.sender === 'agent') setTyping(false)
            break
          case 'typing':
            setTyping(true)
            setError(null)
            break
          case 'checkin':
            setCheckin(frame.checkin)
            break
          case 'action_update':
            setMessages((prev) => prev.map((m) => (m.id === frame.messageId ? { ...m, action: frame.action } : m)))
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

  const startCheckIn = useCallback((mood: Mood | null): boolean => {
    const ws = wsRef.current
    if (ws === null || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify({ type: 'start_checkin', mood }))
    setError(null)
    return true
  }, [])

  const confirm = useCallback((actionId: string, approve: boolean): boolean => {
    const ws = wsRef.current
    if (ws === null || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify({ type: 'confirm', actionId, approve }))
    setError(null)
    return true
  }, [])

  /** Elders send 'family_reply'; caretakers send 'family_message'. */
  const sendFamily = useCallback((text: string, kind: 'family_reply' | 'family_message'): boolean => {
    const ws = wsRef.current
    const trimmed = text.trim()
    if (ws === null || ws.readyState !== WebSocket.OPEN || trimmed === '') return false
    ws.send(JSON.stringify({ type: kind, text: trimmed }))
    setError(null)
    return true
  }, [])

  /** Run an action chip (e.g. a reminder) on a family message. The server checks it's allowed and unused. */
  const runChip = useCallback((messageId: string, chip: number): boolean => {
    const ws = wsRef.current
    if (ws === null || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify({ type: 'family_action', messageId, chip }))
    setError(null)
    return true
  }, [])

  return { messages, family, status, typing, error, checkin, send, startCheckIn, confirm, sendFamily, runChip }
}
