const IMGBB_API_KEY = "f948b09fe08842df76fafe41f1c73491";

// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyD65dSuHGEtLz09luim3YMgVWubAQXYZHs",
    authDomain: "eventify011.firebaseapp.com",
    projectId: "eventify011",
    storageBucket: "eventify011.firebasestorage.app",
    messagingSenderId: "704470408337",
    appId: "1:704470408337:web:af95827bf49c6bb0c2b330"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 3. UI DOM ELEMENTS
const authForm = document.getElementById('authForm');
const toggleModeBtn = document.getElementById('toggleMode');
const submitBtn = document.getElementById('submitBtn');
const nameGroup = document.getElementById('nameGroup');
const brandTitle = document.querySelector('.brand h2');
const vendorLoginBtn = document.getElementById('vendorLogin');

// NEW FIELDS DOM ELEMENTS
const studentFields = document.getElementById('studentFields');
const vendorFields = document.getElementById('vendorFields');

// --- STATE TRACKING ---
let isLoginMode = true;
let isVendorMode = false;
let isSigningUp = false; // Stops the router from freezing during registration

// ==========================================
// THE SMART AUTO-ROUTER (For Logins Only)
// ==========================================
auth.onAuthStateChanged((user) => {
    // Only run the auto-router if the user is logging in. 
    // If they are registering, we handle it manually below to prevent bugs.
    if (user && !isSigningUp) {
        checkUserRole(user.uid, 5); 
    }
});

function checkUserRole(uid, retries) {
    db.collection('users').doc(uid).get().then((doc) => {
        if (doc.exists) {
            const role = doc.data().role;
            if (role === 'admin') window.location.href = "admin.html";
            else if (role === 'participant') window.location.href = "student.html";
            else if (role === 'vendor') window.location.href = "vendor.html";
            else {
                alert("Unauthorized role. Please contact support.");
                auth.signOut();
                resetLoginButton();
            }
        } else {
            if (retries > 0) {
                setTimeout(() => checkUserRole(uid, retries - 1), 1000);
            } else {
                alert("Profile not found. Please refresh the page.");
                resetLoginButton();
            }
        }
    }).catch((error) => {
        console.error("Router error:", error);
        resetLoginButton();
    });
}

function resetLoginButton() {
    submitBtn.innerText = isLoginMode ? "Sign In" : "Sign Up";
    submitBtn.disabled = false;
}

// ==========================================
// UI LOGIC: TOGGLE LOGIN / SIGNUP / VENDOR
// ==========================================

toggleModeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    updateUI();
});

vendorLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isVendorMode = true;
    isLoginMode = true; 
    updateUI();
});

// Click the Neon Lightning Bolt to reset back to Student Login
document.querySelector('.brand .neon-icon').addEventListener('click', () => {
    isVendorMode = false;
    isLoginMode = true;
    updateUI();
});

function updateUI() {
    if (isVendorMode) {
        brandTitle.innerText = isLoginMode ? "Vendor Access" : "Vendor Registration";
    } else {
        brandTitle.innerText = isLoginMode ? "Eventify" : "Join Eventify";
    }

    if (isLoginMode) {
        // HIDE EVERYTHING FOR LOGIN
        nameGroup.classList.add('hidden');
        studentFields.classList.add('hidden');
        vendorFields.classList.add('hidden');
        
        // REMOVE REQUIRED ATTRIBUTES
        document.getElementById('fullName').removeAttribute('required');
        document.getElementById('mobile').removeAttribute('required');
        document.getElementById('college').removeAttribute('required');
        document.getElementById('visitingCard').removeAttribute('required');
        
        submitBtn.innerText = "Sign In";
        toggleModeBtn.innerText = "Create an account";
    } else {
        // SHOW NAME FIELD FOR ALL SIGNUPS
        nameGroup.classList.remove('hidden');
        document.getElementById('fullName').setAttribute('required', 'true');
        
        if (isVendorMode) {
            // SHOW VENDOR FIELDS
            vendorFields.classList.remove('hidden');
            studentFields.classList.add('hidden');
            document.getElementById('visitingCard').setAttribute('required', 'true');
            document.getElementById('mobile').removeAttribute('required');
            document.getElementById('college').removeAttribute('required');
        } else {
            // SHOW STUDENT FIELDS
            studentFields.classList.remove('hidden');
            vendorFields.classList.add('hidden');
            document.getElementById('mobile').setAttribute('required', 'true');
            document.getElementById('college').setAttribute('required', 'true');
            document.getElementById('visitingCard').removeAttribute('required');
        }

        submitBtn.innerText = "Sign Up";
        toggleModeBtn.innerText = "Back to Sign In";
    }
}

// ==========================================
// FORM SUBMISSION: LOGIN & REGISTRATION
// ==========================================
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    
    submitBtn.innerText = "Processing...";
    submitBtn.disabled = true;

    if (isLoginMode) {
        // --- LOGIN LOGIC ---
        isSigningUp = false; 
        auth.signInWithEmailAndPassword(email, password)
            .catch((error) => {
                alert("Login Error: " + error.message);
                resetLoginButton();
            });
            
    } else {
        // --- REGISTRATION LOGIC ---
        isSigningUp = true; 
        
        const fullName = document.getElementById('fullName').value.trim();
        const targetRole = isVendorMode ? 'vendor' : 'participant';
        
        let visitingCardUrl = null;

        try {
            // IF VENDOR: Upload Visiting Card to ImgBB First
            if (isVendorMode) {
                submitBtn.innerText = "Uploading Card...";
                const imageFile = document.getElementById('visitingCard').files[0];
                const formData = new FormData();
                formData.append('image', imageFile);

                const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                    method: 'POST',
                    body: formData
                });
                const imgbbData = await imgbbResponse.json();
                visitingCardUrl = imgbbData.data.url;
            }

            submitBtn.innerText = "Creating Account...";

            // Create Firebase Auth Account
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Prepare Data for Database
            const userData = {
                name: fullName,
                email: email,
                role: targetRole,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Add role-specific data
            if (isVendorMode) {
                userData.visitingCardUrl = visitingCardUrl;
            } else {
                userData.mobile = document.getElementById('mobile').value.trim();
                userData.college = document.getElementById('college').value.trim();
            }

            // Save to Firestore
            await db.collection('users').doc(user.uid).set(userData);

            // Success! Redirect.
            if (targetRole === 'vendor') {
                window.location.href = "vendor.html";
            } else {
                window.location.href = "student.html";
            }

        } catch (error) {
            isSigningUp = false; // Unblock if there's an error
            alert("Registration Error: " + error.message);
            resetLoginButton();
        }
    }
});