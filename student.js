// 1. PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
    apiKey: "AIzaSyD65dSuHGEtLz09luim3YMgVWubAQXYZHs",
    authDomain: "eventify011.firebaseapp.com",
    projectId: "eventify011",
    storageBucket: "eventify011.firebasestorage.app",
    messagingSenderId: "704470408337",
    appId: "1:704470408337:web:af95827bf49c6bb0c2b330"
};

// 2. YOUR IMGBB API KEY
const IMGBB_API_KEY = "f948b09fe08842df76fafe41f1c73491";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUserData = null;
let allEventsCache = []; // Stores all events for quick filtering

// SECURITY CHECK
auth.onAuthStateChanged((user) => {
    if (user) {
        db.collection('users').doc(user.uid).get().then((doc) => {
            if (doc.exists && doc.data().role === 'participant') {
                currentUserData = { uid: user.uid, ...doc.data() };
                document.getElementById('studentNameDisplay').innerText = currentUserData.name;
                loadActiveFestsAndEvents();
                loadMyRegistrations();
            } else if (doc.exists && doc.data().role === 'admin') {
                window.location.href = "admin.html"; 
            } else {
                window.location.href = "index.html";
            }
        });
    } else {
        window.location.href = "index.html";
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());

// TAB LOGIC
const tabBrowse = document.getElementById('tab-browse');
const tabMyEvents = document.getElementById('tab-my-events');
const sectionBrowse = document.getElementById('section-browse');
const sectionMyEvents = document.getElementById('section-my-events');

tabBrowse.addEventListener('click', () => {
    tabBrowse.classList.add('active'); tabMyEvents.classList.remove('active');
    sectionBrowse.classList.remove('hidden'); sectionMyEvents.classList.add('hidden');
});

tabMyEvents.addEventListener('click', () => {
    tabMyEvents.classList.add('active'); tabBrowse.classList.remove('active');
    sectionMyEvents.classList.remove('hidden'); sectionBrowse.classList.add('hidden');
});


// ==========================================
// PREMIUM UI RENDERING & FILTERING
// ==========================================

function loadActiveFestsAndEvents() {
    const container = document.getElementById('browseContainer');
    container.innerHTML = `<div style="text-align:center; padding: 50px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; color:var(--primary);"></i><p style="margin-top:15px;">Loading amazing events...</p></div>`;

    db.collection('fests').where('isLive', '==', true).get().then((festSnapshot) => {
        container.innerHTML = "";
        
        if(festSnapshot.empty) {
            container.innerHTML = "<p style='color:var(--text-muted); text-align:center;'>No active fests right now. Check back later!</p>";
            return;
        }

        festSnapshot.forEach((festDoc) => {
            const fest = festDoc.data();
            
            // Render Fest Header (with poster if available)
            const festBannerHTML = fest.posterUrl ? `<img src="${fest.posterUrl}" class="fest-header-img">` : '';
            
            const festSection = document.createElement('div');
            festSection.innerHTML = `
                <div class="glass-card" style="padding: 30px;">
                    ${festBannerHTML}
                    <h2 style="color:var(--primary); font-size: 2rem; margin-bottom:5px;">${fest.festName}</h2>
                    <p style="color:var(--text-muted); font-size:1rem; margin-bottom:25px;">${fest.startDate} to ${fest.endDate} | ${fest.description}</p>
                    
                    <div class="event-grid" id="events-for-${festDoc.id}"></div>
                </div>
            `;
            container.appendChild(festSection);

            // Fetch Events for this Fest
            db.collection('events').where('festId', '==', festDoc.id).get().then((eventSnapshot) => {
                const eventContainer = document.getElementById(`events-for-${festDoc.id}`);
                
                if(eventSnapshot.empty) {
                    eventContainer.innerHTML = "<small style='color:var(--text-muted)'>Events dropping soon!</small>";
                } else {
                    eventSnapshot.forEach((eventDoc) => {
                        const event = eventDoc.data();
                        
                        // Default placeholder if Admin didn't upload a poster
                        const defaultPoster = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80";
                        const posterImg = event.posterUrl || defaultPoster;
                        const categoryTag = event.category || "General";

                        // Build Netflix-Style Card
                        const cardHTML = `
                            <div class="event-card event-item-card" data-category="${categoryTag}">
                                <img src="${posterImg}" class="event-poster" loading="lazy">
                                <div class="event-details">
                                    <div>
                                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                                            <h3 style="font-size:1.2rem; color:white;">${event.eventName}</h3>
                                            <span class="badge" style="background:rgba(108, 43, 217, 0.2); color:var(--primary); border: 1px solid var(--primary);">${categoryTag}</span>
                                        </div>
                                        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:15px; line-height: 1.4;">${event.description}</p>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                                        <div>
                                            <strong style="color:var(--accent); font-size: 1.1rem;">₹${event.entryFee}</strong><br>
                                            <small style="color:var(--text-muted);"><i class="fa-regular fa-calendar"></i> ${event.eventDate}</small>
                                        </div>
                                        <button class="btn-primary" style="width:auto; padding:8px 20px; font-size:0.9rem;" 
                                            onclick="openPaymentModal('${eventDoc.id}', '${event.eventName}', ${event.entryFee})">
                                            Register
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                        eventContainer.innerHTML += cardHTML;
                    });
                }
            });
        });
    });
}

// FILTER LOGIC
const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        filterBtns.forEach(b => b.classList.remove('active'));
        // Add active class to clicked
        btn.classList.add('active');
        
        const selectedCategory = btn.getAttribute('data-category');
        const allEventCards = document.querySelectorAll('.event-item-card');
        
        allEventCards.forEach(card => {
            if (selectedCategory === "All" || card.getAttribute('data-category') === selectedCategory) {
                card.style.display = "flex"; // Show
            } else {
                card.style.display = "none"; // Hide
            }
        });
    });
});

// ==========================================
// MODAL & REGISTRATION LOGIC
// ==========================================
const modal = document.getElementById('paymentModal');
const overlay = document.getElementById('modalOverlay');

window.openPaymentModal = function(eventId, eventName, eventFee) {
    document.getElementById('modalEventName').innerText = eventName;
    document.getElementById('modalEventFee').innerText = eventFee;
    document.getElementById('regEventId').value = eventId;
    document.getElementById('regEventName').value = eventName;
    document.getElementById('regEventFee').value = eventFee;
    
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
}

document.getElementById('closeModalBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);

function closeModal() {
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
    document.getElementById('registrationForm').reset();
}

document.getElementById('registrationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitRegBtn');
    submitBtn.innerText = "Uploading Proof...";
    submitBtn.disabled = true;

    const fileInput = document.getElementById('paymentScreenshot');
    const imageFile = fileInput.files[0];

    try {
        const formData = new FormData();
        formData.append('image', imageFile);

        const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const imgbbData = await imgbbResponse.json();
        const imageUrl = imgbbData.data.url; 

        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        const bookingId = `EVT-${randomStr}`;

        submitBtn.innerText = "Saving Registration...";
        
        await db.collection('registrations').add({
            eventId: document.getElementById('regEventId').value,
            eventName: document.getElementById('regEventName').value,
            amount: Number(document.getElementById('regEventFee').value),
            userId: currentUserData.uid,
            userName: currentUserData.name,
            userEmail: currentUserData.email, // Saved for EmailJS Receipts later
            userMobile: currentUserData.mobile || 'N/A', 
            userCollege: currentUserData.college || 'N/A', 
            bookingId: bookingId,
            transactionId: document.getElementById('upiTxnId').value,
            screenshotUrl: imageUrl,
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`Success! Your Booking ID is ${bookingId}. Waiting for Admin approval.`);
        closeModal();
    } catch (error) {
        alert("An error occurred: " + error.message);
    } finally {
        submitBtn.innerText = "Submit Payment Proof";
        submitBtn.disabled = false;
    }
});

// LOAD MY REGISTRATIONS
function loadMyRegistrations() {
    db.collection('registrations').where('userId', '==', auth.currentUser.uid).onSnapshot((snapshot) => {
        const table = document.getElementById('myRegistrationsTable');
        table.innerHTML = "";
        if(snapshot.empty) { table.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">You haven't registered for any events yet.</td></tr>`; return; }

        snapshot.forEach((doc) => {
            const reg = doc.data();
            let badgeClass = reg.status === 'pending' ? 'style="background: rgba(255, 165, 0, 0.2); color: orange;"' : 
                             reg.status === 'verified' ? 'style="background: rgba(0, 255, 0, 0.2); color: #00ff00;"' : 
                             'style="background: rgba(255, 0, 0, 0.2); color: #ff4757;"';

            table.innerHTML += `
                <tr>
                    <td style="font-family:monospace; color:var(--accent);">${reg.bookingId}</td>
                    <td>${reg.eventName}</td>
                    <td>₹${reg.amount}</td>
                    <td><span class="badge" ${badgeClass}>${reg.status.toUpperCase()}</span></td>
                </tr>`;
        });
    });
}