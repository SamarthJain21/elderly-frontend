# Elderly — frontend (prototype)

Mobile-first React app for the **Elder** and **Caretaker** journeys, built to sit on top of
[`elderly-backend`](https://github.com/SamarthJain21/elderly-backend) (FastAPI + Firebase + Gemini).

```bash
npm install
npm run dev        # http://localhost:5173  (port matches the backend's CORS default)
npm run typecheck
npm run build
```

## Try it on your phone

Both servers listen on your local network (phone and computer on the same Wi-Fi):

```bash
npm run dev          # http://<your-computer-IP>:5173  — quick look
npm run dev:phone    # https://<your-computer-IP>:5174 — use this to test the microphone
```

Phones only allow the microphone on secure (https) pages, so `dev:phone` uses a self-signed certificate:
the first time, the browser warns — tap **Advanced → Proceed** (Chrome) or **Show Details → visit this website** (Safari).
Find your IP with `ipconfig` (Wi-Fi → IPv4 Address). If the phone can't connect, allow Node.js through the
Windows firewall for your network.

## What's in it

| Route | What |
|---|---|
| `/` | Showcase launcher |
| `/demo` | **Live side-by-side**: Grandma's and Emma's phones syncing in real time |
| `/elder` | Elder app: voice home, check-in, faces to call, family voice messages with big replies, helper chat with action cards (Yes/No), "My day", hold-for-help, emergency countdown, calls |
| `/caretaker` | Caretaker app: status + activity, chat (backend-native: text + one-tap replies, simple next steps), approvals (incl. quota top-up), helper rules (4 modes × 6 tools + spending limits), people & volunteers, routine, profile & privacy (incl. nickname), plan & billing |
| `/onboarding/caretaker` | 9 animated steps: welcome **+ how we handle data** → Google sign-in → who you care for (nickname, consent) → your name → daily rhythm (sun/moon sky) → medicines (pill organiser) → faces → independence (balance) → plan |
| `/onboarding/elder` | 7 big read-aloud steps on their own phone: hello → scan code → meet helper → mic permission → try it → your people → done |
| `/pricing`, `/caretaker/plan`, `/caretaker/checkout/:plan` | Basic / Premium / Pro, monthly/yearly, INR/THB/SGD, card + UPI/PromptPay/PayNow mock checkout, invoices, top-ups, cancel/resume |

## Plans (src/lib/plans.ts)

| | Basic | Premium | Pro |
|---|---|---|---|
| Price / month | Free | ₹299 · ฿199 · S$9.90 | ₹699 · ฿449 · S$19.90 |
| AI voice helper (STT + TTS), family chat, check-ins, SOS | ✓ | ✓ | ✓ |
| Volunteer calls / month | 5 | 20 | 50 |
| Family members | 2 | 4 | 8 |
| Extras | — | Daily AI summary, priority matching | 10% off medicine + free delivery, weekly report, care coordinator |

Yearly = 10× monthly (2 months free). Top-up: 5 volunteer calls for ₹99 · ฿69 · S$3.90.
When the quota runs out, volunteer requests are held for the caretaker with **Top up & approve** / **Upgrade**.

## Live mode (real backend) and demo mode

The app runs in **live mode** by default: Firebase Auth + the deployed backend
(`https://elderly-api-37kiaykfwa-as.a.run.app`, override with `VITE_API_URL`). **Demo mode** keeps everything in the
browser with pretend data — `/demo`, the embedded side-by-side phones and any URL with `?demo` always use it, and the
launcher has a "Switch to demo / Use real account" toggle (`src/data/mode.ts`).

| Piece | File |
|---|---|
| Firebase sign-in (Google for family, email + one-time password for elders) | `src/lib/firebase.ts` |
| REST client + `/ws/{elderId}` socket | `src/data/api.ts` |
| Session, loading, socket frames, writes | `src/data/live.ts` |
| Every UI action → backend when live, demo otherwise | `src/data/actions.ts` |
| `/login`, route guard | `src/live/Login.tsx` |

**How it flows.** Family signs in with Google → `/me` (404 = new → onboarding: `POST /onboarding/caretaker`, `POST /elders`,
`PUT /assessment`, `PUT /profile`, `PUT /rules`, contacts, extra check-in reminders) → "Connect their phone" makes a setup link
`/join/<id>#<email+password>`; the part after `#` never leaves the phone. Opening it signs the elder in and starts the spoken
welcome. Elders get the agent chat + family thread over the socket; family gets the family thread over the socket and
approvals / activity / requests by polling every 15 s.

**Coming soon** (marked in the UI because the backend has no endpoint yet): care credit, top-ups and plans; "send someone"
dispatch in SOS (calling 995/112/1669 and the elder works); an instant "phone connected" signal (we infer it from the elder's
first chat or check-in); syncing the nickname across devices; re-sending the one-time password; volunteer verification;
marking alerts handled on the server (kept per device).

**Testing on a phone in live mode** needs two settings outside this repo: add the phone's origin (e.g.
`https://192.168.1.37:5174`) to the backend CORS list (`deploy.sh` / `app/config.py`), and add that host under
Firebase → Authentication → Settings → Authorized domains. Until then use live mode on `http://localhost:5173`, and demo
mode on the phone.

All data shapes mirror the backend's Pydantic models (`src/lib/types.ts`); the demo's helper decisions use a port of
`app/autonomy.py` (`src/lib/policy.ts`) with a keyword stand-in for Gemini.

**Family chat mirrors the backend's chips** (`app/agent/chips.py`): every family message carries one-tap `chips` for whoever
receives it — a message to send, a ⏰ reminder (`family_action` → reminder + system note, used once), or a 📞 call (phone link).
The demo copies the backend's presets so both modes show the same options.

**Screens for existing backend features**: family members & invites (`/caretakers`), help requests with status
(`PATCH /requests`), 7-day check-in history (`/checkins`), structured home address + emergency contacts (`PUT /profile`),
check-in days and several medicine times (`PUT /assessment`). The helper answers weather questions with live Open-Meteo data
(same source as the backend's `check_weather`), and emergencies end with "family alerted" + a button to call the local
number (112 / 1669 / 995) — never auto-dialled, like `escalate_emergency`.

**Nickname**: the caretaker picks what they call their person (Mom, Dad, Grandma, Grandpa… or their own word);
the whole app uses it. Stored client-side for now — suggest adding a `nickname` field to the elder profile.

**Frontend-only for now** (no backend support yet): subscriptions/billing & quotas, nickname, contact photos,
data export/delete — shown as "Coming soon" in live mode.

Speech uses the Web Speech API (best in Chrome/Edge; mic needs HTTPS or localhost).
