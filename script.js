// ------------------- FULL BUSINESS LOGIC -------------------
const PLANS = [
    { amount: 150, returns: 750 },
    { amount: 200, returns: 1000 },
    { amount: 250, returns: 1250 },
    { amount: 300, returns: 1500 },
    { amount: 350, returns: 1750 },
    { amount: 400, returns: 2000 },
    { amount: 500, returns: 2500 }
];
let currentUser = null;
let selectedPlanAmount = null;

// Preload 20 testimonials
const defaultTestimonials = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    userName: ["Kwame", "Adwoa", "Michael", "Esi", "Daniel", "Felicia", "Emmanuel", "Grace", "Isaac", "Janet", "Richard", "Sandra", "Prince", "Linda", "Franklin", "Rebecca", "James", "Mavis", "Bright", "Stella"][i] + " " + ["Asante", "Mensah", "Osei", "Boateng", "Tetteh", "Owusu", "Asare", "Amankwah", "Nyarko", "Adjei", "Nkrumah", "Poku", "Agyeman", "Asare", "Dadzie", "Amoah", "Asiedu", "Ofori", "Kumi", "Annan"][i],
    comment: `Invested GHS ${150 + (i * 13)} and received ${(150 + (i * 13)) * 5} profit! Absolutely reliable platform.`,
    rating: 5,
    date: "2025-03-01"
}));

function loadTestimonials() {
    let stored = localStorage.getItem('bamboo_testimonials');
    if (stored) return JSON.parse(stored);
    localStorage.setItem('bamboo_testimonials', JSON.stringify(defaultTestimonials));
    return defaultTestimonials;
}

function saveTestimonials(t) {
    localStorage.setItem('bamboo_testimonials', JSON.stringify(t));
}

function getUsers() {
    return JSON.parse(localStorage.getItem('bamboo_users') || '{}');
}

function saveUsers(users) {
    localStorage.setItem('bamboo_users', JSON.stringify(users));
}

function generateReferralCode(email) {
    return btoa(email.split('@')[0] + Date.now()).substring(0, 10);
}

function registerUser(name, email, phone, pwd, refCode) {
    let users = getUsers();
    if (users[email]) throw new Error("Email already registered");
    let newUser = {
        name, email, phone, password: pwd,
        investments: [],
        referralBonusTotal: 30,
        myReferralCode: generateReferralCode(email),
        referredBy: null,
        totalInvested: 0,
        pendingReturns: 0,
        bonusGiven: true
    };
    if (refCode) {
        for (let e in users) {
            if (users[e].myReferralCode === refCode) {
                newUser.referredBy = e;
                break;
            }
        }
    }
    users[email] = newUser;
    saveUsers(users);
    return newUser;
}

function login(email, pwd) {
    let u = getUsers()[email];
    if (!u) throw new Error("Account not found");
    if (u.password !== pwd) throw new Error("Incorrect password");
    return u;
}

function updateUser(u) {
    let users = getUsers();
    users[u.email] = u;
    saveUsers(users);
}

function addInvestment(user, amount, ret) {
    user.investments.push({ amount, returnAmount: ret, status: 'pending' });
    user.totalInvested += amount;
    user.pendingReturns += ret;
    if (user.referredBy) {
        let ref = getUsers()[user.referredBy];
        if (ref) {
            ref.referralBonusTotal += amount * 0.03;
            updateUser(ref);
        }
    }
    updateUser(user);
    return user;
}

function requestWithdraw(user, amt) {
    let available = user.pendingReturns + (user.referralBonusTotal || 0);
    if (amt > available) throw new Error(`Insufficient funds. Available GHS ${available.toFixed(2)}`);
    let fee = amt * 0.03;
    let deduct = amt;
    let deductPending = Math.min(deduct, user.pendingReturns);
    user.pendingReturns -= deductPending;
    deduct -= deductPending;
    for (let inv of user.investments) {
        if (inv.status === 'pending' && deductPending > 0) {
            inv.status = 'withdrawn';
            deductPending -= inv.returnAmount;
        }
    }
    if (deduct > 0) user.referralBonusTotal = Math.max(0, (user.referralBonusTotal || 0) - deduct);
    updateUser(user);
    return { amt, fee, net: amt - fee };
}

// Render Investment Plans with "Invest Now" button
function renderPlans() {
    let container = document.getElementById('plansContainer');
    container.innerHTML = PLANS.map((p, idx) => `
        <div class="plan-card" data-plan-amount="${p.amount}" data-plan-return="${p.returns}">
            <div class="plan-amount">GHS ${p.amount}</div>
            <div style="margin: 16px 0;"><i class="fas fa-arrow-right" style="color: #D4AF37;"></i></div>
            <div style="font-size: 1.8rem; font-weight: 700; color: #0F4C3A;">GHS ${p.returns}</div>
            <div style="margin: 8px 0;">Profit +GHS ${p.returns - p.amount}</div>
            <button class="invest-now-btn" data-amount="${p.amount}" data-return="${p.returns}" style="margin-top: 20px; background: #0F4C3A; color: white; width: 100%; padding: 12px; border-radius: 40px; border: none; cursor: pointer; font-weight: 600;">Invest Now</button>
        </div>
    `).join('');

    // Add click handlers for plan selection (blue highlight)
    document.querySelectorAll('.plan-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('invest-now-btn')) return;
            document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedPlanAmount = parseInt(card.dataset.planAmount);
        });
    });

    // Add investment button handlers
    document.querySelectorAll('.invest-now-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentUser) {
                alert("Please login first");
                return;
            }
            let amt = parseInt(btn.dataset.amount);
            let ret = parseInt(btn.dataset.return);
            initiatePaystack(amt, ret);
        });
    });
}

function initiatePaystack(amount, returnAmt) {
    // 🔧 REPLACE WITH YOUR PAYSTACK PUBLIC KEY
    const PAYSTACK_PUBLIC_KEY = "pk_live_322e5d5775eb0e9ad30e1ab3aa81ae5949c62127";
    let handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: currentUser.email,
        amount: amount * 100,
        currency: "GHS",
        ref: "INV_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
        callback: function(response) {
            if (response.status === 'success') {
                currentUser = addInvestment(currentUser, amount, returnAmt);
                updateDashboardUI();
                alert(`✅ Invested GHS ${amount}! Expected return: GHS ${returnAmt}`);
            }
        },
        onClose: function() {}
    });
    handler.openIframe();
}

function updateDashboardUI() {
    if (!currentUser) {
        document.getElementById('dashboardLoggedIn').style.display = 'none';
        document.getElementById('dashboardLoggedOut').style.display = 'block';
        return;
    }
    document.getElementById('dashboardLoggedOut').style.display = 'none';
    document.getElementById('dashboardLoggedIn').style.display = 'block';
    document.getElementById('dashUserName').innerText = currentUser.name.split(' ')[0];
    document.getElementById('dashPhone').innerText = currentUser.phone;
    document.getElementById('totalInvestedVal').innerText = currentUser.totalInvested.toFixed(2);
    document.getElementById('pendingReturnsVal').innerText = currentUser.pendingReturns.toFixed(2);
    document.getElementById('referralEarningsVal').innerText = (currentUser.referralBonusTotal || 0).toFixed(2);
    let link = `${window.location.origin}${window.location.pathname}?ref=${currentUser.myReferralCode}`;
    document.getElementById('referralLinkDisplay').value = link;
    document.getElementById('userShortName').innerText = currentUser.name.split(' ')[0];
    document.getElementById('userShortName').style.display = 'inline-block';
    document.getElementById('logoutBtnMobile').style.display = 'inline-block';
    document.getElementById('showAuthBtn').style.display = 'none';
}

function renderTestimonialsUI() {
    let t = loadTestimonials();
    document.getElementById('testimonialsGrid').innerHTML = t.map(tm => `
        <div class="testimonial-card">
            <div style="color: #D4AF37;">${'★'.repeat(tm.rating)}${'☆'.repeat(5 - tm.rating)}</div>
            <p style="margin: 12px 0; color: #4b5563;">“${tm.comment.substring(0, 120)}”</p>
            <p style="font-weight: 600; color: #1f2937;">- ${tm.userName}</p>
            <span style="font-size: 11px; color: #9ca3af;"><i class="fas fa-check-circle"></i> Verified Investor</span>
        </div>
    `).join('');
}

// Withdraw logic
document.getElementById('requestWithdrawBtn')?.addEventListener('click', () => {
    if (!currentUser) return;
    let amt = parseFloat(document.getElementById('withdrawAmountInput').value);
    if (isNaN(amt) || amt < 10) alert("Enter valid amount (min GHS 10)");
    else {
        try {
            let res = requestWithdraw(currentUser, amt);
            currentUser = getUsers()[currentUser.email];
            updateDashboardUI();
            alert(`Withdrawal request: GHS ${res.amt}, Fee: GHS ${res.fee.toFixed(2)}, Net: GHS ${res.net.toFixed(2)}`);
            document.getElementById('withdrawAmountInput').value = '';
            document.getElementById('feePreviewBox').innerHTML = 'Fee preview will appear here';
        } catch (e) {
            alert(e.message);
        }
    }
});

document.getElementById('withdrawAmountInput')?.addEventListener('input', function() {
    let val = parseFloat(this.value) || 0;
    document.getElementById('feePreviewBox').innerHTML = `💸 Withdrawal fee (3%): GHS ${(val * 0.03).toFixed(2)}<br>🏦 You receive: GHS ${(val * 0.97).toFixed(2)}`;
});

// Navigation & Dropdown
function showSection(section) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active-section'));
    document.getElementById(section + 'Section').classList.add('active-section');
    if (window.innerWidth < 768) document.getElementById('mobileDropdownMenu').classList.remove('open');
}

document.querySelectorAll('.desktop-nav-link').forEach(el => {
    el.addEventListener('click', () => showSection(el.dataset.nav));
});

document.querySelectorAll('.mobile-nav-item').forEach(el => {
    if (el.dataset.mobileNav) {
        el.addEventListener('click', () => showSection(el.dataset.mobileNav));
    }
});

document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
    document.getElementById('mobileDropdownMenu').classList.toggle('open');
});

document.getElementById('mobileLogoutItem')?.addEventListener('click', () => logout());

function logout() {
    currentUser = null;
    localStorage.removeItem('bamboo_session');
    updateDashboardUI();
    document.getElementById('userShortName').style.display = 'none';
    document.getElementById('logoutBtnMobile').style.display = 'none';
    document.getElementById('showAuthBtn').style.display = 'inline-block';
    showSection('dashboard');
}

function saveSession(email) {
    localStorage.setItem('bamboo_session', email);
}

function autoLogin() {
    let email = localStorage.getItem('bamboo_session');
    if (email && getUsers()[email]) {
        currentUser = getUsers()[email];
        updateDashboardUI();
        return true;
    }
    return false;
}

// Auth modal handlers with Green Toggle
const authModal = document.getElementById('authModal');
document.getElementById('showAuthBtn').onclick = () => authModal.style.display = 'flex';
document.getElementById('closeAuthModalBtn').onclick = () => authModal.style.display = 'none';

// Green toggle between login and register
const loginTab = document.getElementById('showLoginTab');
const registerTab = document.getElementById('showRegisterTab');
const loginPanel = document.getElementById('loginPanel');
const registerPanel = document.getElementById('registerPanel');

function setActiveTab(isLogin) {
    if (isLogin) {
        loginTab.classList.add('active');
        loginTab.classList.remove('inactive');
        registerTab.classList.add('inactive');
        registerTab.classList.remove('active');
        loginPanel.style.display = 'block';
        registerPanel.style.display = 'none';
    } else {
        registerTab.classList.add('active');
        registerTab.classList.remove('inactive');
        loginTab.classList.add('inactive');
        loginTab.classList.remove('active');
        loginPanel.style.display = 'none';
        registerPanel.style.display = 'block';
    }
}

loginTab.onclick = () => setActiveTab(true);
registerTab.onclick = () => setActiveTab(false);

// Login
document.getElementById('doLoginBtn').onclick = () => {
    let email = document.getElementById('loginEmail').value.trim();
    let pwd = document.getElementById('loginPassword').value;
    try {
        currentUser = login(email, pwd);
        saveSession(email);
        authModal.style.display = 'none';
        updateDashboardUI();
        showSection('dashboard');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    } catch (e) {
        alert(e.message);
    }
};

// Register with confirm password validation
document.getElementById('doRegisterBtn').onclick = () => {
    let name = document.getElementById('regName').value.trim();
    let email = document.getElementById('regEmail').value.trim();
    let phone = document.getElementById('regPhone').value.trim();
    let pwd = document.getElementById('regPassword').value;
    let confirmPwd = document.getElementById('regConfirmPassword').value;
    
    if (!name || !email || !phone) return alert("Please fill all fields");
    if (pwd.length < 6) return alert("Password must be at least 6 characters");
    if (pwd !== confirmPwd) return alert("Passwords do not match!");
    
    let ref = new URLSearchParams(location.search).get('ref');
    try {
        currentUser = registerUser(name, email, phone, pwd, ref);
        saveSession(email);
        authModal.style.display = 'none';
        updateDashboardUI();
        showSection('dashboard');
        alert("Registration successful! +GHS 30 Bonus added!");
        document.getElementById('regName').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPhone').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regConfirmPassword').value = '';
    } catch (e) {
        alert(e.message);
    }
};

// Contact Modal
document.getElementById('showContactModal').onclick = () => document.getElementById('contactModal').style.display = 'flex';
document.getElementById('closeContactModal').onclick = () => document.getElementById('contactModal').style.display = 'none';

// Testimonial Modal
document.getElementById('addTestimonialBtn').onclick = () => {
    if (!currentUser) alert("Please login to share your story");
    else document.getElementById('testimonialFormModal').style.display = 'flex';
};
document.getElementById('closeTestimonialModalBtn').onclick = () => document.getElementById('testimonialFormModal').style.display = 'none';
document.getElementById('submitTestimonialBtn').onclick = () => {
    let comment = document.getElementById('testimonialComment').value;
    let author = document.getElementById('testimonialAuthor').value;
    let rating = document.getElementById('testimonialStars').value;
    if (comment && author) {
        let t = loadTestimonials();
        t.unshift({
            id: Date.now(),
            userName: author,
            comment: comment,
            rating: parseInt(rating),
            date: new Date().toLocaleDateString()
        });
        saveTestimonials(t);
        renderTestimonialsUI();
        document.getElementById('testimonialFormModal').style.display = 'none';
        alert("Thank you for sharing your success story!");
        document.getElementById('testimonialComment').value = '';
        document.getElementById('testimonialAuthor').value = '';
    } else {
        alert("Please fill all fields");
    }
};

// Copy referral link
document.getElementById('copyLinkBtn').onclick = () => {
    let inp = document.getElementById('referralLinkDisplay');
    inp.select();
    document.execCommand('copy');
    alert("Referral link copied!");
};

// Mobile menu toggle responsive
if (window.innerWidth <= 767) document.getElementById('mobileMenuToggle').style.display = 'block';
window.addEventListener('resize', () => {
    if (window.innerWidth <= 767) document.getElementById('mobileMenuToggle').style.display = 'block';
    else document.getElementById('mobileMenuToggle').style.display = 'none';
});

// Initialize
renderPlans();
renderTestimonialsUI();
autoLogin();
updateDashboardUI();
if (!currentUser) {
    document.getElementById('dashboardLoggedIn').style.display = 'none';
    document.getElementById('dashboardLoggedOut').style.display = 'block';
}

// Close modals when clicking outside
window.onclick = (event) => {
    if (event.target === document.getElementById('authModal')) authModal.style.display = 'none';
    if (event.target === document.getElementById('contactModal')) document.getElementById('contactModal').style.display = 'none';
    if (event.target === document.getElementById('testimonialFormModal')) document.getElementById('testimonialFormModal').style.display = 'none';
};