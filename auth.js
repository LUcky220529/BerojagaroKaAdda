let currentUser = null;

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  
  if (user) {
    if (window.getUserProfile) {
      const profile = await window.getUserProfile();
      if (!profile || !profile.username) {
        promptForUsername();
      } else {
        currentUser.customUsername = profile.username;
        currentUser.customPhoto = profile.photoURL || null;
      }
    }
    updateAuthUI(user);
    if (window.loadWatchHistory) window.loadWatchHistory();
  } else {
    updateAuthUI(null);
    if (window.renderContinueWatching) window.renderContinueWatching([]);
  }
});

async function promptForUsername() {
  if (document.getElementById('usernameModal')) return;
  const html = `
    <div id="usernameModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px)">
      <div style="background:var(--surface);padding:30px;border-radius:12px;width:90%;max-width:400px;text-align:center;border:1px solid var(--border)">
        <h2 style="margin-bottom:10px;font-family:'Bebas Neue',sans-serif;letter-spacing:1px;font-size:2rem">Pick Your Adda Name</h2>
        <p style="color:var(--text-muted);margin-bottom:20px;font-size:0.9rem">This unique name will be shown on your reviews.</p>
        <input type="text" id="usernameInput" placeholder="e.g. MovieBuff99" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);margin-bottom:15px;font-family:'Poppins',sans-serif"/>
        <p id="usernameError" style="color:var(--gold);font-size:0.8rem;margin-bottom:15px;display:none"></p>
        <button id="saveUsernameBtn" class="btn-primary" style="width:100%;padding:12px;border:none;border-radius:8px;background:var(--primary);color:#fff;font-weight:600;cursor:pointer">Save Name</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  
  const btn = document.getElementById('saveUsernameBtn');
  const input = document.getElementById('usernameInput');
  const err = document.getElementById('usernameError');
  
  btn.onclick = async () => {
    const val = input.value.trim();
    if (val.length < 3) { err.textContent = 'Name must be at least 3 characters'; err.style.display = 'block'; return; }
    
    btn.innerHTML = 'Checking...';
    btn.disabled = true;
    
    const exists = await window.checkUsernameExists(val);
    if (exists) {
      err.textContent = 'This name is already taken! Try another.';
      err.style.display = 'block';
      btn.innerHTML = 'Save Name';
      btn.disabled = false;
      return;
    }
    
    btn.innerHTML = 'Saving...';
    const success = await window.saveUsername(val);
    if (success) {
      document.getElementById('usernameModal').remove();
      currentUser.customUsername = val;
      updateAuthUI(currentUser);
    } else {
      err.textContent = 'Error saving. Please try again.';
      err.style.display = 'block';
      btn.innerHTML = 'Save Name';
      btn.disabled = false;
    }
  };
}

let isLoggingIn = false;

window.loginUser = async function() {
  if (isLoggingIn) return;
  console.log("Login button clicked!");
  
  isLoggingIn = true;
  const btn = document.getElementById('authBtn');
  if (btn) btn.innerHTML = "⏳ Wait...";
  
  try {
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error("Login failed:", error);
    // Ignore errors caused by the user closing the popup or clicking twice
    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
      alert("Login failed: " + error.message);
    }
  } finally {
    isLoggingIn = false;
    if (!currentUser) window.updateAuthUI(null);
  }
};

window.logoutUser = async function() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Logout failed:", error);
  }
};

window.getCurrentUser = function() {
  return currentUser;
};

window.updateAuthUI = function(user) {
  const authBtn = document.getElementById('authBtn');
  let profileBtn = document.getElementById('profileBtn');
  
  if (!authBtn) return;
  
  if (user) {
    const displayName = user.customUsername || (user.displayName ? user.displayName.split(' ')[0] : 'User');
    const finalPhoto = user.customPhoto || user.photoURL;
    const avatarImg = finalPhoto 
        ? `<img src="${finalPhoto}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;border:1px solid var(--border);">`
        : `<span style="font-size:1.1rem;vertical-align:middle;margin-right:5px;">👤</span>`;

    if (!profileBtn) {
      profileBtn = document.createElement('button');
      profileBtn.id = 'profileBtn';
      profileBtn.className = 'nav-btn';
      profileBtn.style.display = 'inline-flex';
      profileBtn.style.alignItems = 'center';
      profileBtn.onclick = () => { window.location.href = 'profile.html'; };
      authBtn.parentNode.insertBefore(profileBtn, authBtn);
    } else {
      profileBtn.style.display = 'inline-flex';
    }
    
    profileBtn.innerHTML = `${avatarImg} <span>${displayName}</span>`;

    authBtn.innerHTML = `🚪 Logout`;
    authBtn.onclick = () => {
      if(confirm('Do you want to log out?')) window.logoutUser();
    };
  } else {
    if (profileBtn) profileBtn.style.display = 'none';
    authBtn.innerHTML = `🔐 Sign In`;
    authBtn.onclick = window.loginUser;
  }
};


