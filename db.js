window.saveWatchHistory = async function(movieData) {
  const user = window.getCurrentUser ? window.getCurrentUser() : null;
  if (!db || !user) return;

  try {
    const historyRef = db.collection('users').doc(user.uid).collection('history').doc(movieData.id.toString());
    await historyRef.set({
      ...movieData,
      watchedAt: Date.now()
    }, { merge: true });
    
    window.loadWatchHistory();
  } catch (error) {
    console.error("Error saving watch history:", error);
  }
};

window.loadWatchHistory = async function() {
  const user = window.getCurrentUser ? window.getCurrentUser() : null;
  if (!db || !user) {
    if (window.renderContinueWatching) window.renderContinueWatching([]);
    return;
  }

  try {
    const historyCol = db.collection('users').doc(user.uid).collection('history');
    const snapshot = await historyCol.orderBy('watchedAt', 'desc').limit(10).get();
    
    const history = [];
    snapshot.forEach((doc) => {
      history.push(doc.data());
    });
    
    if (window.renderContinueWatching) {
      window.renderContinueWatching(history);
    }
  } catch (error) {
    console.error("Error loading watch history:", error);
  }
};

/* ===== CLOUD REVIEWS & USERNAME ===== */

window.getUserProfile = async function() {
  const user = window.getCurrentUser ? window.getCurrentUser() : null;
  if (!db || !user) return null;
  
  try {
    const docSnap = await db.collection('users').doc(user.uid).get();
    return docSnap.exists ? docSnap.data() : null;
  } catch (e) {
    console.error("Error fetching user profile:", e);
    return null;
  }
};

window.checkUsernameExists = async function(username) {
  if (!db) return true; // Fail safe
  const usernameLower = username.trim().toLowerCase();
  try {
    const docSnap = await db.collection('usernames').doc(usernameLower).get();
    return docSnap.exists;
  } catch (e) {
    console.error("Error checking username:", e);
    return true; // Assume taken on error
  }
};

window.saveUsername = async function(username) {
  const user = window.getCurrentUser ? window.getCurrentUser() : null;
  if (!db || !user) return false;
  
  const usernameLower = username.trim().toLowerCase();
  const displayUsername = username.trim();
  
  try {
    // 1. Claim username
    await db.collection('usernames').doc(usernameLower).set({ uid: user.uid, createdAt: Date.now() });
    
    // 2. Save to user profile
    await db.collection('users').doc(user.uid).set({
      username: displayUsername,
      email: user.email,
      updatedAt: Date.now()
    }, { merge: true });
    
    return true;
  } catch (e) {
    console.error("Error saving username:", e);
    return false;
  }
};

window.submitCloudReview = async function(movieId, reviewData) {
  const user = window.getCurrentUser ? window.getCurrentUser() : null;
  if (!db || !user) return false;
  
  const profile = await window.getUserProfile();
  if (!profile || !profile.username) return false;

  try {
    // Add review to movies/{movieId}/reviews/{uid}
    // Using user's UID as doc ID prevents multiple reviews from same user, or use auto-id for multiple.
    // Let's use user.uid so users can only have ONE review per movie (they can update it)
    await db.collection('movies').doc(movieId.toString()).collection('reviews').doc(user.uid).set({
      uid: user.uid,
      username: profile.username,
      val: reviewData.val,
      label: reviewData.label,
      emoji: reviewData.emoji,
      text: reviewData.text,
      date: reviewData.date,
      timestamp: Date.now()
    });
    return true;
  } catch (e) {
    console.error("Error submitting review:", e);
    return false;
  }
};

window.loadCloudReviews = async function(movieId) {
  if (!db) return [];
  try {
    const snapshot = await db.collection('movies').doc(movieId.toString()).collection('reviews').orderBy('timestamp', 'desc').get();
    const reviews = [];
    snapshot.forEach(doc => reviews.push(doc.data()));
    return reviews;
  } catch (e) {
    console.error("Error loading reviews:", e);
    return [];
  }
};
