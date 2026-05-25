// 1. FIREBASE & IMGBB CONFIGURATION
const IMGBB_API_KEY = "f948b09fe08842df76fafe41f1c73491";

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

// 2. SECURITY CHECK & INITIALIZATION
auth.onAuthStateChanged((user) => {
    if (user) {
        db.collection('users').doc(user.uid).get().then((doc) => {
            if (doc.exists && doc.data().role === 'admin') {
                loadFests(); 
                populateFestSelector();
                initRealTimeNotifications(); // Start BOTH notification listeners
            } else {
                window.location.href = "index.html";
            }
        });
    } else {
        window.location.href = "index.html";
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());

// ==========================================
// TAB NAVIGATION LOGIC
// ==========================================
const tabFests = document.getElementById('tab-fests');
const tabEvents = document.getElementById('tab-events');
const tabRegistrations = document.getElementById('tab-registrations');
const tabQuotes = document.getElementById('tab-quotes');

const sectionFests = document.getElementById('section-fests');
const sectionEvents = document.getElementById('section-events');
const sectionRegistrations = document.getElementById('section-registrations');
const sectionQuotes = document.getElementById('section-quotes');

function hideAllSections() {
    [tabFests, tabEvents, tabRegistrations, tabQuotes].forEach(t => t.classList.remove('active'));
    [sectionFests, sectionEvents, sectionRegistrations, sectionQuotes].forEach(s => s.classList.add('hidden'));
}

tabFests.addEventListener('click', () => { hideAllSections(); tabFests.classList.add('active'); sectionFests.classList.remove('hidden'); });
tabEvents.addEventListener('click', () => { hideAllSections(); tabEvents.classList.add('active'); sectionEvents.classList.remove('hidden'); });
tabRegistrations.addEventListener('click', () => { hideAllSections(); tabRegistrations.classList.add('active'); sectionRegistrations.classList.remove('hidden'); loadRegistrations(); });
tabQuotes.addEventListener('click', () => { hideAllSections(); tabQuotes.classList.add('active'); sectionQuotes.classList.remove('hidden'); loadVendorQuotes(); });

// ==========================================
// HELPER: UPLOAD IMAGE TO IMGBB
// ==========================================
async function uploadToImgBB(file) {
    if (!file) return null;
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
    const data = await response.json();
    return data.data.url;
}

// ==========================================
// FEST MANAGER LOGIC (Updated for Posters)
// ==========================================
const showFestFormBtn = document.getElementById('showFestFormBtn');
const festFormCard = document.getElementById('festFormCard');
const createFestForm = document.getElementById('createFestForm');
const saveFestBtn = document.getElementById('saveFestBtn');

let festsCache = {}; 
let editingFestId = null;

showFestFormBtn.addEventListener('click', () => {
    if (festFormCard.classList.contains('hidden')) { festFormCard.classList.remove('hidden'); showFestFormBtn.innerText = "Cancel"; } 
    else { resetFestForm(); }
});

function resetFestForm() {
    createFestForm.reset();
    festFormCard.classList.add('hidden');
    showFestFormBtn.innerText = "+ Create New Fest";
    saveFestBtn.innerText = "Save Fest";
    festFormCard.querySelector('h3').innerText = "Create a New Fest";
    editingFestId = null;
}

createFestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveFestBtn.innerText = "Uploading & Saving...";
    saveFestBtn.disabled = true;

    try {
        let festPosterUrl = editingFestId ? festsCache[editingFestId].posterUrl : null;
        const fileInput = document.getElementById('festPoster').files[0];
        
        if (fileInput) {
            festPosterUrl = await uploadToImgBB(fileInput); // Upload new image if provided
        }

        const festData = {
            festName: document.getElementById('festName').value,
            description: document.getElementById('festDesc').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            posterUrl: festPosterUrl,
            isLive: true
        };

        if (editingFestId) {
            await db.collection('fests').doc(editingFestId).update(festData);
        } else {
            festData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('fests').add(festData);
        }
        resetFestForm();
    } catch (err) {
        alert("Error saving fest: " + err.message);
    } finally {
        saveFestBtn.innerText = "Save Fest";
        saveFestBtn.disabled = false;
    }
});

function loadFests() {
    db.collection('fests').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        const tableBody = document.getElementById('festTableBody');
        tableBody.innerHTML = ""; festsCache = {};
        snapshot.forEach((doc) => {
            const fest = doc.data();
            festsCache[doc.id] = fest;
            
            const imgThumbnail = fest.posterUrl ? `<img src="${fest.posterUrl}" style="width:40px; height:40px; border-radius:5px; object-fit:cover; margin-right:10px;">` : `<i class="fa-solid fa-image" style="margin-right:10px; color:var(--text-muted); font-size: 1.5rem;"></i>`;

            tableBody.innerHTML += `
                <tr>
                    <td style="display:flex; align-items:center;">
                        ${imgThumbnail}
                        <div><strong>${fest.festName}</strong><br><small style="color: var(--text-muted)">${fest.description}</small></div>
                    </td>
                    <td>${fest.startDate}</td>
                    <td><span class="badge ${fest.isLive ? 'live' : ''}">${fest.isLive ? 'Active' : 'Hidden'}</span></td>
                    <td>
                        <button style="background:none; border:none; color:var(--accent); cursor:pointer; margin-right: 10px;" onclick="editFest('${doc.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button style="background:none; border:none; color:#ff4757; cursor:pointer;" onclick="deleteFest('${doc.id}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`;
        });
    });
}

window.editFest = function(id) {
    editingFestId = id;
    const fest = festsCache[id];
    document.getElementById('festName').value = fest.festName;
    document.getElementById('festDesc').value = fest.description;
    document.getElementById('startDate').value = fest.startDate;
    document.getElementById('endDate').value = fest.endDate;
    festFormCard.classList.remove('hidden');
    showFestFormBtn.innerText = "Cancel";
    saveFestBtn.innerText = "Update Fest";
    festFormCard.querySelector('h3').innerText = "Edit Fest Details";
}
window.deleteFest = function(id) { if(confirm("Delete this fest?")) db.collection('fests').doc(id).delete(); }


// ==========================================
// EVENT MANAGER LOGIC (Updated for Posters & Categories)
// ==========================================
const festSelector = document.getElementById('festSelector');
const showEventFormBtn = document.getElementById('showEventFormBtn');
const eventFormCard = document.getElementById('eventFormCard');
const createEventForm = document.getElementById('createEventForm');
const saveEventBtn = document.getElementById('saveEventBtn');
const eventTableBody = document.getElementById('eventTableBody');

let eventsCache = {}; 
let editingEventId = null;
let currentFestId = null;
let currentEventSnapshotUnsubscribe = null;

function populateFestSelector() {
    db.collection('fests').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        festSelector.innerHTML = '<option value="" disabled selected>Select a Fest to manage its events...</option>';
        snapshot.forEach((doc) => { festSelector.innerHTML += `<option value="${doc.id}">${doc.data().festName}</option>`; });
    });
}

festSelector.addEventListener('change', (e) => {
    currentFestId = e.target.value;
    showEventFormBtn.classList.remove('hidden');
    resetEventForm();
    loadEventsForFest(currentFestId);
});

showEventFormBtn.addEventListener('click', () => {
    if (eventFormCard.classList.contains('hidden')) { eventFormCard.classList.remove('hidden'); showEventFormBtn.innerText = "Cancel"; } 
    else { resetEventForm(); }
});

function resetEventForm() {
    createEventForm.reset();
    eventFormCard.classList.add('hidden');
    showEventFormBtn.innerText = "+ Add Event";
    saveEventBtn.innerText = "Save Event";
    eventFormCard.querySelector('h3').innerText = "Add New Event to Fest";
    editingEventId = null;
}

createEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentFestId) return alert("Please select a fest first!");
    
    saveEventBtn.innerText = "Uploading & Saving...";
    saveEventBtn.disabled = true;

    try {
        let eventPosterUrl = editingEventId ? eventsCache[editingEventId].posterUrl : null;
        const fileInput = document.getElementById('eventPoster').files[0];
        
        if (fileInput) {
            eventPosterUrl = await uploadToImgBB(fileInput); // Upload new image if provided
        }

        const eventData = {
            festId: currentFestId,
            eventName: document.getElementById('eventName').value,
            category: document.getElementById('eventCategory').value, // NEW: Category Saved
            description: document.getElementById('eventDesc').value,
            eventDate: document.getElementById('eventDate').value,
            entryFee: Number(document.getElementById('eventFee').value),
            posterUrl: eventPosterUrl
        };

        if (editingEventId) {
            await db.collection('events').doc(editingEventId).update(eventData);
        } else {
            eventData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('events').add(eventData);
        }
        resetEventForm();
    } catch (err) {
        alert("Error saving event: " + err.message);
    } finally {
        saveEventBtn.innerText = "Save Event";
        saveEventBtn.disabled = false;
    }
});

function loadEventsForFest(festId) {
    if (currentEventSnapshotUnsubscribe) currentEventSnapshotUnsubscribe();
    currentEventSnapshotUnsubscribe = db.collection('events').where('festId', '==', festId).onSnapshot((snapshot) => {
        eventTableBody.innerHTML = ""; eventsCache = {};
        if(snapshot.empty) {
            eventTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No events found for this fest.</td></tr>`;
            return;
        }
        snapshot.forEach((doc) => {
            const event = doc.data();
            eventsCache[doc.id] = event;
            const imgThumbnail = event.posterUrl ? `<img src="${event.posterUrl}" style="width:40px; height:40px; border-radius:5px; object-fit:cover; margin-right:10px;">` : ``;

            eventTableBody.innerHTML += `
                <tr>
                    <td style="display:flex; align-items:center;">
                        ${imgThumbnail}
                        <div>
                            <strong>${event.eventName}</strong> <span class="badge" style="font-size:0.7rem; padding: 2px 6px;">${event.category || 'General'}</span><br>
                            <small style="color: var(--text-muted)">${event.description}</small>
                        </div>
                    </td>
                    <td>₹${event.entryFee}</td>
                    <td>${event.eventDate}</td>
                    <td>
                        <button style="background:none; border:none; color:var(--accent); cursor:pointer; margin-right: 10px;" onclick="editEvent('${doc.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button style="background:none; border:none; color:#ff4757; cursor:pointer;" onclick="deleteEvent('${doc.id}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`;
        });
    });
}

window.editEvent = function(id) {
    editingEventId = id;
    const event = eventsCache[id];
    document.getElementById('eventName').value = event.eventName;
    document.getElementById('eventCategory').value = event.category || '';
    document.getElementById('eventDesc').value = event.description;
    document.getElementById('eventDate').value = event.eventDate;
    document.getElementById('eventFee').value = event.entryFee;
    eventFormCard.classList.remove('hidden');
    showEventFormBtn.innerText = "Cancel";
    saveEventBtn.innerText = "Update Event";
    eventFormCard.querySelector('h3').innerText = "Edit Event Details";
}
window.deleteEvent = function(id) { if(confirm("Delete this event?")) db.collection('events').doc(id).delete(); }


// ==========================================
// REGISTRATIONS, EXPORT & QUOTES LOGIC (Unchanged - Keeps features intact)
// ==========================================
function loadRegistrations() {
    const regTable = document.getElementById('registrationTableBody');
    db.collection('registrations').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
        regTable.innerHTML = "";
        if(snapshot.empty) { regTable.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No registrations yet.</td></tr>`; return; }
        snapshot.forEach((doc) => {
            const reg = doc.data();
            let bClass = reg.status === 'pending' ? 'style="background: rgba(255, 165, 0, 0.2); color: orange;"' : 
                         reg.status === 'verified' ? 'style="background: rgba(0, 255, 0, 0.2); color: #00ff00;"' : 
                         'style="background: rgba(255, 0, 0, 0.2); color: #ff4757;"';

            regTable.innerHTML += `
                <tr>
                    <td><strong>${reg.userName}</strong><br><small style="color:var(--text-muted)">${reg.userCollege || 'N/A'} | ${reg.userMobile || 'N/A'}</small><br><small style="color:var(--accent)">${reg.bookingId}</small></td>
                    <td>${reg.eventName}<br><small style="color:var(--text-muted)">₹${reg.amount}</small></td>
                    <td style="font-family: monospace;">${reg.transactionId || 'N/A'}</td>
                    <td>${reg.screenshotUrl ? `<a href="${reg.screenshotUrl}" target="_blank" style="color:var(--accent); text-decoration:none;"><i class="fa-solid fa-image"></i> View</a>` : 'No Image'}</td>
                    <td><span class="badge" ${bClass}>${reg.status.toUpperCase()}</span></td>
                    <td>
                        ${reg.status === 'pending' ? `
                            <button onclick="updateStatus('${doc.id}', 'verified')" style="background:rgba(0,255,0,0.2); border:none; padding:5px 10px; border-radius:5px; color:#00ff00; cursor:pointer; margin-right:5px;"><i class="fa-solid fa-check"></i></button>
                            <button onclick="updateStatus('${doc.id}', 'rejected')" style="background:rgba(255,0,0,0.2); border:none; padding:5px 10px; border-radius:5px; color:#ff4757; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                        ` : '<small style="color:var(--text-muted)">Action Taken</small>'}
                    </td>
                </tr>`;
        });
    });
}

window.updateStatus = function(regId, newStatus) { if(confirm(`Mark as ${newStatus}?`)) db.collection('registrations').doc(regId).update({ status: newStatus }); }

function loadVendorQuotes() {
    const container = document.getElementById('quoteContainer');
    db.collection('quotations').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
        container.innerHTML = "";
        if(snapshot.empty) { container.innerHTML = `<p style="color:var(--text-muted)">No quotations received yet.</p>`; return; }
        snapshot.forEach((doc) => {
            const quote = doc.data();
            const cardLink = quote.visitingCardUrl ? `<a href="${quote.visitingCardUrl}" target="_blank" style="color:var(--primary); font-size:0.9rem; text-decoration:none;"><i class="fa-solid fa-id-card"></i> View ID Card</a>` : `<small style="color:#ff4757;">No ID Provided</small>`;
            container.innerHTML += `
                <div class="glass-card" style="margin-bottom:0;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                        <h3 style="color:var(--accent);">₹${quote.amount}</h3>
                        <span class="badge" style="background:rgba(255,255,255,0.1);">${quote.eventName}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <p style="font-weight:600;">${quote.vendorName}</p>
                        ${cardLink}
                    </div>
                    <p style="color:var(--text-muted); font-size:0.9rem; line-height:1.4;">${quote.message}</p>
                    <hr style="border:none; border-top:1px solid var(--glass-border); margin:15px 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <small style="color:var(--text-muted);">${quote.timestamp ? new Date(quote.timestamp.toDate()).toLocaleDateString() : 'Just now'}</small>
                        <button onclick="deleteQuote('${doc.id}')" style="background:none; border:none; color:#ff4757; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
    });
}
window.deleteQuote = function(id) { if(confirm("Remove this quote?")) db.collection('quotations').doc(id).delete(); }

window.exportToCSV = async function() {
    const snapshot = await db.collection('registrations').get();
    if(snapshot.empty) return alert("No data to export!");
    let csvContent = "data:text/csv;charset=utf-8,Booking ID,Student Name,College,Mobile,Event,Amount,Status\n";
    snapshot.forEach(doc => {
        const r = doc.data();
        csvContent += `"${r.bookingId}","${r.userName}","${r.userCollege || 'N/A'}","${r.userMobile || 'N/A'}","${r.eventName}",${r.amount},"${r.status}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Eventify_Participant_List.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// REAL-TIME NOTIFICATIONS (Upgraded for Vendors too!)
// ==========================================
function initRealTimeNotifications() {
    let isInitialRegLoad = true;
    let isInitialQuoteLoad = true;

    // 1. Listen for new Student Registrations
    db.collection('registrations').orderBy('timestamp', 'desc').limit(1).onSnapshot((snapshot) => {
        if (isInitialRegLoad) { isInitialRegLoad = false; return; }
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const reg = change.doc.data();
                showToast(`🚀 New Registration: ${reg.userName} for ${reg.eventName}`);
            }
        });
    });

    // 2. Listen for new Vendor Quotes
    db.collection('quotations').orderBy('timestamp', 'desc').limit(1).onSnapshot((snapshot) => {
        if (isInitialQuoteLoad) { isInitialQuoteLoad = false; return; }
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const quote = change.doc.data();
                showToast(`💼 New Quote: ₹${quote.amount} from ${quote.vendorName}`);
            }
        });
    });
}

function showToast(msg) {
    const toast = document.getElementById('notifToast');
    document.getElementById('notifText').innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 5000);
}