// 1. PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
    apiKey: "AIzaSyD65dSuHGEtLz09luim3YMgVWubAQXYZHs",
    authDomain: "eventify011.firebaseapp.com",
    projectId: "eventify011",
    storageBucket: "eventify011.firebasestorage.app",
    messagingSenderId: "704470408337",
    appId: "1:704470408337:web:af95827bf49c6bb0c2b330"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentVendor = null;

// SECURITY CHECK
auth.onAuthStateChanged((user) => {
    if (user) {
        db.collection('users').doc(user.uid).get().then((doc) => {
            if (doc.exists && doc.data().role === 'vendor') {
                currentVendor = { uid: user.uid, ...doc.data() };
                document.getElementById('vendorNameDisplay').innerText = currentVendor.name;
                loadEventsForVendors();
            } else { window.location.href = "index.html"; }
        });
    } else { window.location.href = "index.html"; }
});

document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());

// LOAD EVENTS WITH VERIFIED COUNTS
async function loadEventsForVendors() {
    const container = document.getElementById('vendorEventContainer');
    const eventSnap = await db.collection('events').get();
    container.innerHTML = "";

    eventSnap.forEach(async (doc) => {
        const event = doc.data();
        const eventId = doc.id;

        // Get count of VERIFIED registrations only
        const regSnap = await db.collection('registrations')
            .where('eventId', '==', eventId)
            .where('status', '==', 'verified')
            .get();
        
        const verifiedCount = regSnap.size;

        const card = `
            <div class="glass-card">
                <h3 style="color:white;">${event.eventName}</h3>
                <p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:15px;">Date: ${event.eventDate}</p>
                <div style="background:rgba(108, 43, 217, 0.2); padding:15px; border-radius:12px; text-align:center; margin-bottom:15px;">
                    <h1 style="color:var(--accent);">${verifiedCount}</h1>
                    <p style="font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;">Verified Students</p>
                </div>
                <button class="btn-primary" onclick="openQuoteModal('${eventId}', '${event.eventName}')">Submit Quote</button>
            </div>
        `;
        container.innerHTML += card;
    });
}

// MODAL LOGIC
window.openQuoteModal = (id, name) => {
    document.getElementById('quoteEventId').value = id;
    document.getElementById('quoteEventName').innerText = name;
    document.getElementById('quoteModal').classList.remove('hidden');
    document.getElementById('quoteOverlay').classList.remove('hidden');
}

window.closeQuoteModal = () => {
    document.getElementById('quoteModal').classList.add('hidden');
    document.getElementById('quoteOverlay').classList.add('hidden');
}

// SUBMIT QUOTE
document.getElementById('quoteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitQuoteBtn');
    btn.innerText = "Sending...";
    
    await db.collection('quotations').add({
        vendorId: currentVendor.uid,
        vendorName: currentVendor.name,
		visitingCardUrl: currentVendor.visitingCardUrl || null,
        eventId: document.getElementById('quoteEventId').value,
        eventName: document.getElementById('quoteEventName').innerText,
        amount: document.getElementById('quoteAmount').value,
        message: document.getElementById('quoteMessage').value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Quotation sent to Admin!");
    closeQuoteModal();
    btn.innerText = "Send Quote to Admin";
});