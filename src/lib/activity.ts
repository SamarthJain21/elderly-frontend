import type { Language } from './types'

/** What the elder sees under the typing dots while an action runs (server frame `typing` with `tool`). */
type Labels = Record<string, string>

const EN: Labels = {
  order_food: 'Finding your food…', order_medicine: 'Checking your medicine…', book_ride: 'Finding a taxi…',
  set_reminder: 'Setting your reminder…', send_message_to_caretaker: 'Sending to your family…',
  check_weather: 'Checking the weather…', notify_volunteer: 'Asking someone to help…', call_contact: 'Getting the call ready…',
  escalate_emergency: 'Alerting your family…',
}
const LABELS: Partial<Record<Language, Labels>> = {
  'en-US': EN,
  'hi-IN': {
    order_food: 'खाना ढूँढ रहे हैं…', order_medicine: 'दवाई देख रहे हैं…', book_ride: 'टैक्सी ढूँढ रहे हैं…',
    set_reminder: 'रिमाइंडर लगा रहे हैं…', send_message_to_caretaker: 'परिवार को भेज रहे हैं…',
    check_weather: 'मौसम देख रहे हैं…', notify_volunteer: 'मदद के लिए किसी को बुला रहे हैं…', call_contact: 'कॉल तैयार कर रहे हैं…',
    escalate_emergency: 'परिवार को खबर कर रहे हैं…',
  },
  'hi-Latn': {
    order_food: 'Khana dhoondh rahe hain…', order_medicine: 'Dawai dekh rahe hain…', book_ride: 'Taxi dhoondh rahe hain…',
    set_reminder: 'Reminder laga rahe hain…', send_message_to_caretaker: 'Family ko bhej rahe hain…',
    check_weather: 'Mausam dekh rahe hain…', notify_volunteer: 'Madad ke liye kisi ko bula rahe hain…', call_contact: 'Call ready kar rahe hain…',
    escalate_emergency: 'Family ko khabar kar rahe hain…',
  },
  'th-TH': {
    order_food: 'กำลังหาอาหาร…', order_medicine: 'กำลังตรวจสอบยา…', book_ride: 'กำลังหารถแท็กซี่…',
    set_reminder: 'กำลังตั้งการเตือน…', send_message_to_caretaker: 'กำลังส่งถึงครอบครัว…',
    check_weather: 'กำลังดูสภาพอากาศ…', notify_volunteer: 'กำลังขอให้คนมาช่วย…', call_contact: 'กำลังเตรียมโทร…',
    escalate_emergency: 'กำลังแจ้งครอบครัว…',
  },
}

/** null → just the dots (unknown tool, or a plain reply). Unknown language → English. */
export function activityLabel(tool: string | null | undefined, lang: Language): string | null {
  if (!tool) return null
  return (LABELS[lang] ?? EN)[tool] ?? EN[tool] ?? null
}
