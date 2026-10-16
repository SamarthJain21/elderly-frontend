/* Family notifications (SOS, worrying check-ins, approvals, messages) when the app isn't open.
   The backend (app/push.py) sends a notification + link; Firebase shows it and opens the link on tap.
   The config is the project's public web config (same as src/lib/firebase.ts). */
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js')
firebase.initializeApp({
  apiKey: 'AIzaSyBsxCOazvOyfF-BeOP_G_yM8M9_9ogBRwU',
  authDomain: 'elderly-3e18c.firebaseapp.com',
  projectId: 'elderly-3e18c',
  messagingSenderId: '968215624615',
  appId: '1:968215624615:web:63ea777fd96fc9e2d2d482',
})
firebase.messaging()
