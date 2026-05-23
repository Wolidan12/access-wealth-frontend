// global.js - Master Sync Engine (Bypass Active)
async function globalSync() {
    const username = localStorage.getItem('username');
    
    // 1. SECURITY: Kick logged-out users back to login
    if (!username) {
        const currentUrl = window.location.href;
        if (!currentUrl.includes('login.html') && !currentUrl.includes('register.html')) { 
            window.location.href = 'login.html'; 
        }
        return; 
    }

    // 2. SUPPORT AGENT ROUTING: Send the CSR to their specific portal
    if (username === 'Support_Agent') {
        if (!window.location.href.includes('support-agent.html')) { 
            window.location.href = 'support-agent.html'; 
        }
        return; 
    }

    try {
        // 3. FETCH: Pull latest data from backend using the 'https://accesswealth-backend-production.up.railway.app bypass
        const response = await fetch(`https://accesswealth-backend-production.up.railway.app:5000/api/user/${username}?t=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            const u = data.user;
            
            // 4. STORE: Keep browser memory perfectly up to date
            localStorage.setItem('balance', u.balance || 0); 
            localStorage.setItem('taskEarnings', u.taskEarnings || 0); 
            localStorage.setItem('daily_earnings', u.daily_earnings || 0); 
            localStorage.setItem('affiliate_balance', u.affiliate_balance || 0); 
            localStorage.setItem('planActivated', u.planActivated);
            localStorage.setItem('activePackage', u.activePackage);
            localStorage.setItem('my_referral_id', u.my_referral_id);

            // 5. UPDATE UI GLOBALLY
            safeUpdate('sidebarName', username.toUpperCase());
            safeUpdate('cardName', username);
            safeUpdate('displayName', username.toUpperCase());
            safeUpdate('displayHandle', "@" + username.toLowerCase().replace(/\s+/g, ''));
            
            // Set Avatars globally
            const avatarUrl = `https://ui-avatars.com/api/?name=${username}&background=d4af37&color=112A46&bold=true`;
            if (document.getElementById('sidebarAvatar')) document.getElementById('sidebarAvatar').src = avatarUrl;
            if (document.getElementById('cardAvatar')) document.getElementById('cardAvatar').src = avatarUrl;
            if (document.getElementById('desktopAvatar')) document.getElementById('desktopAvatar').src = avatarUrl;
            if (document.getElementById('mobileAvatar')) document.getElementById('mobileAvatar').src = avatarUrl;
            
            // Set Referral Link globally
            const refLinkInput = document.getElementById('refLinkInput');
            if (refLinkInput) refLinkInput.value = `${window.location.origin}/register.html?ref=${u.my_referral_id}`;

            // Update Balances globally
            safeMoneyUpdate('liveBalanceDisplay', u.balance || 0); 

            // Update Premium Status globally
            if(u.planActivated === 'true') {
                safeUpdate('sidebarStatus', `Premium (${u.activePackage})`);
                safeUpdate('accountStatusText', `Premium account (${u.activePackage})`);
                
                const setupCard = document.getElementById('setupCard');
                if(setupCard) setupCard.style.display = 'none';
                
                const activateBtn = document.getElementById('activateBtn');
                if(activateBtn) activateBtn.style.display = 'none';
            }

            // Tell the dashboard the sync is complete so it can update the 5-wallet card
            window.dispatchEvent(new Event('globalSyncComplete'));
        }
    } catch (err) { 
        console.error("Access Wealth Sync Blocked. Check Terminal.", err); 
    }
}

// Helpers
function safeUpdate(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function safeMoneyUpdate(id, amount) { const el = document.getElementById(id); if (el) el.innerText = amount.toLocaleString(undefined, {minimumFractionDigits: 2}); }
function logout() { localStorage.clear(); window.location.href = 'login.html'; }

// Run the engine immediately when ANY page loads
document.addEventListener('DOMContentLoaded', globalSync);