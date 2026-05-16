const firebaseConfig = {
  apiKey: "AIzaSyC-AquBBtlO-7z9APVeLFEnJfd7YDsxUrU",
  authDomain: "moviereview-95a5d.firebaseapp.com",
  projectId: "moviereview-95a5d",
  storageBucket: "moviereview-95a5d.firebasestorage.app",
  messagingSenderId: "707122178247",
  appId: "1:707122178247:web:7dfcc5d8a4882392f176e2",
  measurementId: "G-YVZ5JE65S4"
};

// Initialize Firebase using Compat Libraries
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

console.log("Firebase initialized successfully");
