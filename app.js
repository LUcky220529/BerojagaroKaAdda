/* ===== BerojgaroKaAdda — App Logic ===== */
let API_KEY = localStorage.getItem('bka_tmdb_key') || '';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';

const RATINGS = [
  { label: 'Perfection', emoji: '🏆', val: 5, color: '#f5c518' },
  { label: 'Achi Hai', emoji: '👍', val: 4, color: '#22c55e' },
  { label: 'Thik Thak Hai', emoji: '🤷', val: 3, color: '#3b82f6' },
  { label: 'Timepass', emoji: '😐', val: 2, color: '#f59e0b' },
  { label: 'Bakwas', emoji: '👎', val: 1, color: '#ef4444' }
];

let genres = [], activeGenre = null, mediaType = 'all', currentPage = 1;
let heroMovies = [], heroIdx = 0, heroInterval;
let modalMovieId = null, modalMediaType = 'movie', selectedRating = null;

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  createParticles();
  setupNavScroll();
  setupSearch();
  if (!API_KEY) { showApiKeyPrompt(); return; }
  const ok = await validateKey();
  if (!ok) { showApiKeyPrompt(); return; }
  await loadAll();
}

async function validateKey() {
  try { const r = await fetch(`${BASE}/configuration?api_key=${API_KEY}`); return r.ok; }
  catch { return false; }
}

function showApiKeyPrompt() {
  document.getElementById('heroContent').innerHTML = `
    <div class="hero-badge">🔑 One-Time Setup</div>
    <h1 class="hero-title" style="font-size:2.5rem;animation:heroText .8s ease both">Enter Your TMDB API Key</h1>
    <p class="hero-desc" style="-webkit-line-clamp:unset;opacity:1;animation:heroText .8s .15s ease both">
      1. Go to <a href="https://www.themoviedb.org/signup" target="_blank" style="color:var(--gold)">themoviedb.org/signup</a> — create free account<br/>
      2. Go to <a href="https://www.themoviedb.org/settings/api" target="_blank" style="color:var(--gold)">Settings → API</a><br/>
      3. Copy your <strong>API Key (v3 auth)</strong> and paste below
    </p>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <input id="apiKeyInput" type="text" placeholder="Paste TMDB API key..." style="flex:1;min-width:200px;padding:12px 20px;border-radius:30px;border:2px solid var(--border);background:var(--glass);color:var(--text);font-size:.9rem;font-family:inherit"/>
      <button class="btn-primary" onclick="saveApiKey()">🚀 Start</button>
    </div>`;
}

async function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) { showNotif('API key daal bhai! 😤'); return; }
  API_KEY = key;
  const ok = await validateKey();
  if (!ok) { showNotif('Invalid key! Check again 🔴'); return; }
  localStorage.setItem('bka_tmdb_key', key);
  showNotif('Key saved! Loading movies... 🎬');
  document.getElementById('heroContent').innerHTML = `
    <div class="hero-badge" id="heroBadge">⚡ Trending Now</div>
    <h1 class="hero-title" id="heroTitle">Loading...</h1>
    <div class="hero-meta" id="heroMeta"></div>
    <p class="hero-desc" id="heroDesc"></p>
    <div class="hero-actions">
      <button class="btn-primary" onclick="openHeroModal()">⭐ Rate This</button>
      <button class="btn-ghost" onclick="openHeroModal()">ℹ️ More Info</button>
    </div>`;
  await loadAll();
}

async function loadAll() {
  await loadGenres();
  await loadTrending();
  await loadHero();
}

/* ===== PARTICLES ===== */
function createParticles() {
  const c = document.getElementById('particles');
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const s = Math.random() * 4 + 2;
    p.style.cssText = `width:${s}px;height:${s}px;left:${Math.random()*100}%;animation-duration:${Math.random()*15+10}s;animation-delay:${Math.random()*10}s;`;
    c.appendChild(p);
  }
}

/* ===== NAV SCROLL ===== */
function setupNavScroll() {
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 60);
  });
}

/* ===== API HELPER ===== */
async function tmdb(path, params = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set('api_key', API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url);
  return r.json();
}

/* ===== GENRES ===== */
async function loadGenres() {
  const [m, t] = await Promise.all([tmdb('/genre/movie/list'), tmdb('/genre/tv/list')]);
  const map = {};
  [...(m.genres || []), ...(t.genres || [])].forEach(g => { map[g.id] = g.name; });
  genres = Object.entries(map).map(([id, name]) => ({ id: +id, name }));
  renderGenres();
}

function renderGenres() {
  const c = document.getElementById('genrePills');
  c.innerHTML = `<button class="genre-pill ${!activeGenre ? 'active' : ''}" onclick="filterGenre(null, this)">🔥 All</button>` +
    genres.map(g => `<button class="genre-pill" onclick="filterGenre(${g.id}, this)">${g.name}</button>`).join('');
}

async function filterGenre(id, el) {
  activeGenre = id;
  document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  currentPage = 1;
  if (id) {
    document.getElementById('sectionTitle').textContent = `🎭 ${genres.find(g => g.id === id)?.name || ''} Movies & Series`;
    const data = await tmdb('/discover/movie', { with_genres: id, page: 1 });
    renderGrid(data.results || [], false);
  } else {
    document.getElementById('sectionTitle').textContent = '🔥 Trending This Week';
    await loadTrending();
  }
}

/* ===== TRENDING ===== */
async function loadTrending() {
  let path = '/trending/all/week';
  if (mediaType === 'movie') path = '/trending/movie/week';
  else if (mediaType === 'tv') path = '/trending/tv/week';
  const data = await tmdb(path, { page: currentPage });
  renderGrid(data.results || [], currentPage > 1);
}

function setMediaType(type, el) {
  mediaType = type; currentPage = 1;
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  activeGenre = null;
  document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
  document.querySelector('.genre-pill')?.classList.add('active');
  document.getElementById('sectionTitle').textContent = '🔥 Trending This Week';
  loadTrending();
}

function loadMore() {
  currentPage++;
  if (activeGenre) {
    tmdb('/discover/movie', { with_genres: activeGenre, page: currentPage }).then(d => renderGrid(d.results || [], true));
  } else { loadTrending(); }
}

/* ===== RENDER GRID ===== */
function renderGrid(items, append) {
  const grid = document.getElementById('moviesGrid');
  if (!append) grid.innerHTML = '';
  items.forEach((item, i) => {
    if (!item.poster_path) return;
    const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const title = item.title || item.name || 'Unknown';
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
    const vote = item.vote_average ? item.vote_average.toFixed(1) : '—';
    const review = getUserRating(item.id);
    const card = document.createElement('div');
    card.className = 'movie-card animate-card';
    card.style.animationDelay = `${i * .06}s`;
    card.onclick = () => openModal(item.id, type);
    card.innerHTML = `
      <div class="card-poster">
        <img src="${IMG}w342${item.poster_path}" alt="${title}" loading="lazy"/>
        <span class="card-badge tmdb">⭐ ${vote}</span>
        ${review ? `<span class="card-rating-badge">${review.emoji}</span>` : ''}
        <div class="card-overlay">
          <div class="co-title">${title}</div>
          <div class="co-meta">${year} • ${type === 'tv' ? 'Series' : 'Movie'}</div>
        </div>
      </div>
      <div class="card-info">
        <h3>${title}</h3>
        <div class="ci-row"><span>${year}</span><span class="stars">${'⭐'.repeat(Math.round((item.vote_average || 0) / 2))}</span></div>
      </div>`;
    grid.appendChild(card);
  });
}

/* ===== HERO ===== */
async function loadHero() {
  const data = await tmdb('/trending/movie/day');
  heroMovies = (data.results || []).filter(m => m.backdrop_path).slice(0, 6);
  if (!heroMovies.length) return;
  renderHero(0);
  renderHeroDots();
  heroInterval = setInterval(() => { heroIdx = (heroIdx + 1) % heroMovies.length; renderHero(heroIdx); updateDots(); }, 6000);
}

function renderHero(idx) {
  const m = heroMovies[idx];
  const bg = document.getElementById('heroBg');
  bg.style.backgroundImage = `url(${IMG}original${m.backdrop_path})`;
  bg.classList.remove('active'); void bg.offsetWidth; bg.classList.add('active');
  const t = document.getElementById('heroTitle');
  const meta = document.getElementById('heroMeta');
  const desc = document.getElementById('heroDesc');
  if (t) t.textContent = m.title || m.name;
  const vote = m.vote_average ? m.vote_average.toFixed(1) : '';
  const year = (m.release_date || '').slice(0, 4);
  if (meta) meta.innerHTML = `<span class="tag gold">⭐ ${vote}</span><span class="tag">${year}</span><span class="tag">${m.original_language?.toUpperCase()}</span>`;
  if (desc) desc.textContent = m.overview || '';
  // re-trigger animations
  document.getElementById('heroContent').querySelectorAll('.hero-title,.hero-meta,.hero-desc,.hero-actions').forEach(el => {
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  });
}

function renderHeroDots() {
  document.getElementById('heroDots').innerHTML = heroMovies.map((_, i) => `<div class="hero-dot ${i === 0 ? 'active' : ''}" onclick="goHero(${i})"></div>`).join('');
}
function updateDots() { document.querySelectorAll('.hero-dot').forEach((d, i) => d.classList.toggle('active', i === heroIdx)); }
function goHero(i) {
  heroIdx = i; renderHero(i); updateDots();
  clearInterval(heroInterval);
  heroInterval = setInterval(() => { heroIdx = (heroIdx + 1) % heroMovies.length; renderHero(heroIdx); updateDots(); }, 6000);
}
function openHeroModal() { if (heroMovies[heroIdx]) openModal(heroMovies[heroIdx].id, heroMovies[heroIdx].media_type || 'movie'); }

/* ===== SEARCH ===== */
function setupSearch() {
  const input = document.getElementById('searchInput');
  let timer;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => searchMovies(input.value.trim()), 400); });
  input.addEventListener('focus', () => { if (input.value.trim()) searchMovies(input.value.trim()); });
  document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) document.getElementById('searchDropdown').classList.add('hidden'); });
}

async function searchMovies(q) {
  const dd = document.getElementById('searchDropdown');
  if (!q || !API_KEY) { dd.classList.add('hidden'); return; }
  const data = await tmdb('/search/multi', { query: q, page: 1 });
  const results = (data.results || []).filter(r => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path).slice(0, 8);
  if (!results.length) {
    const similar = await tmdb('/search/multi', { query: q.split(' ')[0], page: 1 });
    const sug = (similar.results || []).filter(r => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path).slice(0, 5);
    dd.innerHTML = `<div class="search-suggest">No exact match for "<strong>${q}</strong>"${sug.length ? '<br>Did you mean:' : ''}</div>` +
      sug.map(s => searchItemHTML(s)).join('');
    dd.classList.remove('hidden'); return;
  }
  dd.innerHTML = results.map(r => searchItemHTML(r)).join('');
  dd.classList.remove('hidden');
}

function searchItemHTML(item) {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const type = item.media_type === 'tv' ? 'Series' : 'Movie';
  return `<div class="search-item" onclick="openModal(${item.id},'${item.media_type}')">
    <img src="${IMG}w92${item.poster_path}" alt="${title}"/>
    <div class="search-item-info"><h4>${title}</h4><p>${year} • ${type} • ⭐ ${(item.vote_average||0).toFixed(1)}</p></div>
  </div>`;
}

/* ===== MODAL ===== */
async function openModal(id, type) {
  modalMovieId = id; modalMediaType = type || 'movie';
  document.getElementById('searchDropdown').classList.add('hidden');
  const [detail, credits, providers] = await Promise.all([
    tmdb(`/${type}/${id}`, { append_to_response: 'external_ids' }),
    tmdb(`/${type}/${id}/credits`),
    tmdb(`/${type}/${id}/watch/providers`)
  ]);
  renderModal(detail, credits, providers);
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function renderModal(d, credits, prov) {
  const title = d.title || d.name || '';
  const year = (d.release_date || d.first_air_date || '').slice(0, 4);
  const runtime = d.runtime ? `${d.runtime} min` : (d.episode_run_time?.[0] ? `${d.episode_run_time[0]} min/ep` : '');
  const genreNames = (d.genres || []).map(g => g.name).join(', ');
  const vote = d.vote_average ? d.vote_average.toFixed(1) : '—';
  const imdbId = d.external_ids?.imdb_id || d.imdb_id || '';
  const backdrop = d.backdrop_path ? `${IMG}original${d.backdrop_path}` : '';

  document.getElementById('modalHero').innerHTML = `
    ${backdrop ? `<img src="${backdrop}" alt="${title}"/>` : '<div style="height:100%;background:var(--card)"></div>'}
    <div class="mh-gradient"></div>
    <div class="mh-info">
      <h1>${title}</h1>
      <div class="mh-meta">
        <span class="mh-tag gold">⭐ ${vote}</span><span class="mh-tag">${year}</span>
        ${runtime ? `<span class="mh-tag">${runtime}</span>` : ''}
        <span class="mh-tag">${d.original_language?.toUpperCase() || ''}</span>
        ${d.seasons ? `<span class="mh-tag">${d.number_of_seasons} Season${d.number_of_seasons > 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>`;

  let html = '';

  // ===== WATCH NOW PLAYER =====
  if (modalMediaType === 'movie') {
    html += `<div class="mb-section player-section">
      <h3>▶️ Watch Now</h3>
      <button class="watch-btn" onclick="togglePlayer()">🎬 Play Movie</button>
      <div class="player-wrap hidden" id="playerWrap">
        <iframe id="videoPlayer" src="" frameborder="0" allowfullscreen allow="autoplay; encrypted-media" class="video-iframe"></iframe>
      </div>
    </div>`;
  } else {
    // Series — season & episode selectors
    const totalSeasons = d.number_of_seasons || 1;
    let seasonOpts = '';
    for (let s = 1; s <= totalSeasons; s++) seasonOpts += `<option value="${s}">Season ${s}</option>`;
    html += `<div class="mb-section player-section">
      <h3>▶️ Watch Now</h3>
      <div class="series-controls">
        <select class="series-select" id="seasonSelect" onchange="loadEpisodes()">${seasonOpts}</select>
        <select class="series-select" id="episodeSelect"><option value="1">Episode 1</option></select>
        <button class="watch-btn" onclick="playEpisode()">🎬 Play Episode</button>
      </div>
      <div class="player-wrap hidden" id="playerWrap">
        <iframe id="videoPlayer" src="" frameborder="0" allowfullscreen allow="autoplay; encrypted-media" class="video-iframe"></iframe>
      </div>
    </div>`;
  }

  // Songs (placeholder — filled async via Deezer)
  html += `<div class="mb-section" id="songsSection"><h3>🎵 Songs & Soundtrack</h3><div class="songs-loading">Loading songs...</div></div>`;
  // Description
  html += `<div class="mb-section"><h3>📖 Overview</h3><p class="mb-desc">${d.overview || 'No description available.'}</p></div>`;
  // Genres
  if (genreNames) html += `<div class="mb-section"><h3>🎭 Genres</h3><p class="mb-desc">${genreNames}</p></div>`;
  // Scores
  html += `<div class="mb-section"><h3>📊 Scores & Ratings</h3><div class="scores-row">
    <div class="score-card"><div class="sc-val gold">${vote}</div><div class="sc-label">TMDB Score</div></div>
    <div class="score-card"><div class="sc-val green">${d.vote_count || 0}</div><div class="sc-label">Votes</div></div>
    ${d.popularity ? `<div class="score-card"><div class="sc-val">${Math.round(d.popularity)}</div><div class="sc-label">Popularity</div></div>` : ''}
    ${imdbId ? `<div class="score-card" style="cursor:pointer" onclick="window.open('https://www.imdb.com/title/${imdbId}','_blank')"><div class="sc-val gold">IMDb</div><div class="sc-label">View on IMDb →</div></div>` : ''}
    <div class="score-card" style="cursor:pointer" onclick="window.open('https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}','_blank')"><div class="sc-val red">🍅</div><div class="sc-label">Rotten Tomatoes →</div></div>
  </div></div>`;
  // Cast
  const cast = (credits.cast || []).slice(0, 12);
  if (cast.length) {
    html += `<div class="mb-section"><h3>🎭 Cast</h3><div class="cast-scroll">${cast.map(c => `
      <div class="cast-card">
        <img src="${c.profile_path ? IMG + 'w185' + c.profile_path : 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2270%22><rect fill=%22%231a1a3e%22 width=%2270%22 height=%2270%22/><text x=%2235%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2220%22>👤</text></svg>'}" alt="${c.name}"/>
        <div class="cc-name">${c.name}</div>
        <div class="cc-char">${c.character || ''}</div>
      </div>`).join('')}</div></div>`;
  }
  // Providers
  const inProv = prov.results?.IN || prov.results?.US;
  const allProv = [...(inProv?.flatrate||[]), ...(inProv?.rent||[]), ...(inProv?.buy||[])];
  const uniqueProv = [...new Map(allProv.map(p => [p.provider_id, p])).values()].slice(0, 8);
  if (uniqueProv.length) {
    html += `<div class="mb-section"><h3>📺 Where to Watch</h3><div class="providers-row">${uniqueProv.map(p => `
      <div class="provider-chip"><img src="${IMG}w45${p.logo_path}" alt="${p.provider_name}"/><span>${p.provider_name}</span></div>`).join('')}</div></div>`;
  }

  // Rating
  const reviews = getReviews(modalMovieId);
  html += `<div class="rating-section"><h3 style="color:var(--gold);margin-bottom:14px">⭐ Rate — Apne Andaaz Mein</h3>
    <div class="rating-options">${RATINGS.map(r => `<button class="rating-btn" data-val="${r.val}" onclick="selectRating(${r.val},this)" style="--rc:${r.color}">${r.emoji} ${r.label}</button>`).join('')}</div>
    <textarea class="review-textarea" id="reviewText" placeholder="Apni raay likho..."></textarea>
    <button class="submit-review" onclick="submitReview()">Submit Review ✨</button>
    <div class="past-reviews" id="pastReviews">${reviews.map(renderReviewCard).join('')}</div>
  </div>`;
  document.getElementById('modalBody').innerHTML = html;

  // If series, auto-load episodes for season 1
  if (modalMediaType === 'tv') loadEpisodes();

  // Fetch songs async
  fetchSongs(title);
}

/* ===== SONGS — Spotify (primary) → iTunes (fallback) ===== */
let spotifyToken = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  const clientId = localStorage.getItem('bka_spotify_id') || '3dd0b0eb27c84ba5b672eb595d3ae447';
  const clientSecret = localStorage.getItem('bka_spotify_secret') || 'b692a653afce433ca09dbadbde85fe27';
  if (!clientId || !clientSecret) return null;
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken;

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(clientId + ':' + clientSecret)
      },
      body: 'grant_type=client_credentials'
    });
    if (res.ok) {
      const data = await res.json();
      spotifyToken = data.access_token;
      spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
      return spotifyToken;
    }
  } catch (e) { /* token fetch failed */ }
  return null;
}

async function fetchSongs(movieName) {
  const section = document.getElementById('songsSection');
  if (!section) return;

  // 1. Try Spotify
  const token = await getSpotifyToken();
  if (token) {
    try {
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(movieName)}&type=track&limit=10&market=IN`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const tracks = data.tracks?.items || [];
        if (tracks.length) {
          renderSpotifySongs(tracks, movieName);
          return;
        }
      }
    } catch (e) { /* spotify search failed */ }
  }

  // 2. Fallback: iTunes
  await fetchItunesFallback(movieName);
}

function renderSpotifySongs(tracks, movieName) {
  const section = document.getElementById('songsSection');
  if (!section) return;

  // De-duplicate
  const seen = new Set();
  const unique = tracks.filter(t => {
    const key = t.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);

  let html = `<h3>🎵 Songs & Soundtrack <span style="font-size:.6rem;color:var(--green);font-weight:400;margin-left:8px">● Spotify</span></h3><div class="songs-grid">`;
  unique.forEach(t => {
    const name = t.name || '';
    const artist = t.artists?.map(a => a.name).join(', ') || '';
    const img = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '';
    const durMs = t.duration_ms || 0;
    const dur = durMs ? `${Math.floor(durMs / 60000)}:${String(Math.floor((durMs % 60000) / 1000)).padStart(2, '0')}` : '';
    const spotifyUrl = t.external_urls?.spotify || '';
    const trackId = t.id || '';

    html += `<div class="song-card" onclick="window.open('${spotifyUrl}','_blank')">
      <img class="song-cover" src="${img}" alt="${name}"/>
      <div class="song-info">
        <div class="song-name">${name}</div>
        <div class="song-artist">${artist}</div>
        ${dur ? `<div class="song-dur">⏱ ${dur}</div>` : ''}
      </div>
      <button class="song-preview spotify-green" onclick="event.stopPropagation();toggleSpotifyEmbed('${trackId}')" title="Play on Spotify">▶</button>
    </div>`;
  });
  html += `</div>
    <div class="spotify-embed-wrap hidden" id="spotifyEmbedWrap">
      <iframe id="spotifyEmbed" src="" width="100%" height="80" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:12px"></iframe>
    </div>
    <a class="songs-link spotify-link" href="https://open.spotify.com/search/${encodeURIComponent(movieName + ' songs')}" target="_blank" style="margin-top:12px">🎵 Open in Spotify</a>`;
  section.innerHTML = html;
}

function toggleSpotifyEmbed(trackId) {
  const wrap = document.getElementById('spotifyEmbedWrap');
  const iframe = document.getElementById('spotifyEmbed');
  if (!wrap || !iframe) return;
  if (!wrap.classList.contains('hidden') && iframe.src.includes(trackId)) {
    wrap.classList.add('hidden');
    iframe.src = '';
    return;
  }
  iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
  wrap.classList.remove('hidden');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* iTunes fallback */
async function fetchItunesFallback(movieName) {
  const section = document.getElementById('songsSection');
  if (!section) return;

  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(movieName + ' songs')}&media=music&entity=song&limit=10&country=IN`);
    if (res.ok) {
      const json = await res.json();
      const songs = (json.results || []).filter(s => s.kind === 'song');
      if (songs.length) { renderItunesSongs(songs, movieName); return; }
    }
  } catch (e) {}

  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(movieName + ' soundtrack')}&media=music&entity=song&limit=10`);
    if (res.ok) {
      const json = await res.json();
      const songs = (json.results || []).filter(s => s.kind === 'song');
      if (songs.length) { renderItunesSongs(songs, movieName); return; }
    }
  } catch (e) {}

  renderSongsFallback(movieName);
}

function renderItunesSongs(songs, movieName) {
  const section = document.getElementById('songsSection');
  if (!section) return;
  const seen = new Set();
  const unique = songs.filter(s => { const k = s.trackName.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);

  let html = `<h3>🎵 Songs & Soundtrack <span style="font-size:.6rem;color:var(--text2);font-weight:400;margin-left:8px">iTunes</span></h3>
    <p style="font-size:.7rem;color:var(--text2);margin-bottom:10px">💡 <a href="#" onclick="event.preventDefault();showSpotifySetup()" style="color:var(--green)">Connect Spotify</a> for better results & embedded player</p>
    <div class="songs-grid">`;
  unique.forEach(s => {
    const name = s.trackName || '';
    const artist = s.artistName || '';
    const img = s.artworkUrl100 || s.artworkUrl60 || '';
    const durMs = s.trackTimeMillis || 0;
    const dur = durMs ? `${Math.floor(durMs / 60000)}:${String(Math.floor((durMs % 60000) / 1000)).padStart(2, '0')}` : '';
    const ytLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' ' + artist)}`;
    const previewUrl = s.previewUrl || '';
    html += `<div class="song-card" onclick="window.open('${ytLink}','_blank')">
      <img class="song-cover" src="${img}" alt="${name}"/>
      <div class="song-info">
        <div class="song-name">${name}</div>
        <div class="song-artist">${artist}</div>
        ${dur ? `<div class="song-dur">⏱ ${dur}</div>` : ''}
      </div>
      ${previewUrl ? `<button class="song-preview" onclick="event.stopPropagation();previewSong(this,'${previewUrl}')" title="Preview">▶</button>` : `<span class="song-play">▶</span>`}
    </div>`;
  });
  html += `</div><a class="songs-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(movieName + ' songs jukebox')}" target="_blank" style="margin-top:12px">🎶 Full Jukebox on YouTube</a>`;
  section.innerHTML = html;
}

function renderSongsFallback(movieName) {
  const section = document.getElementById('songsSection');
  if (!section) return;
  section.innerHTML = `<h3>🎵 Songs & Soundtrack</h3>
    <p class="mb-desc" style="margin-bottom:8px">Song details not available.</p>
    <p style="font-size:.7rem;color:var(--text2);margin-bottom:10px">💡 <a href="#" onclick="event.preventDefault();showSpotifySetup()" style="color:var(--green)">Connect Spotify</a> for song details</p>
    <a class="songs-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(movieName + ' songs jukebox')}" target="_blank">▶️ Search on YouTube</a>`;
}

/* Spotify setup modal */
function showSpotifySetup() {
  const section = document.getElementById('songsSection');
  if (!section) return;
  const existingId = localStorage.getItem('bka_spotify_id') || '';
  section.innerHTML = `<h3>🎵 Connect Spotify</h3>
    <div style="background:var(--card);padding:20px;border-radius:var(--radius-sm);border:1px solid var(--border)">
      <p class="mb-desc" style="margin-bottom:14px">
        1. Go to <a href="https://developer.spotify.com/dashboard" target="_blank" style="color:var(--green)">developer.spotify.com/dashboard</a><br/>
        2. Click <strong>"Create App"</strong> → name it anything → set redirect URI to <code>http://localhost</code><br/>
        3. Copy <strong>Client ID</strong> and <strong>Client Secret</strong> below
      </p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <input id="spotifyIdInput" type="text" placeholder="Client ID" value="${existingId}" style="padding:10px 16px;border-radius:10px;background:var(--glass);border:1px solid var(--border);color:var(--text);font-family:inherit;font-size:.85rem"/>
        <input id="spotifySecretInput" type="password" placeholder="Client Secret" style="padding:10px 16px;border-radius:10px;background:var(--glass);border:1px solid var(--border);color:var(--text);font-family:inherit;font-size:.85rem"/>
        <button class="watch-btn" style="align-self:flex-start;background:linear-gradient(135deg,#1DB954,#169c46)" onclick="saveSpotifyCreds()">🎵 Connect Spotify</button>
      </div>
    </div>`;
}

async function saveSpotifyCreds() {
  const id = document.getElementById('spotifyIdInput').value.trim();
  const secret = document.getElementById('spotifySecretInput').value.trim();
  if (!id || !secret) { showNotif('Both fields required! 😤'); return; }
  localStorage.setItem('bka_spotify_id', id);
  localStorage.setItem('bka_spotify_secret', secret);
  spotifyToken = null; spotifyTokenExpiry = 0;
  const token = await getSpotifyToken();
  if (!token) { showNotif('Invalid credentials! Check and try again 🔴'); return; }
  showNotif('Spotify connected! 🎵✅');
  // Re-fetch songs for current modal
  const title = document.querySelector('.mh-info h1')?.textContent || '';
  if (title) fetchSongs(title);
}

/* 30-second preview player (iTunes fallback) */
let previewAudio = null;
function previewSong(btn, url) {
  if (previewAudio) { previewAudio.pause(); document.querySelectorAll('.song-preview.playing').forEach(b => { b.classList.remove('playing'); b.textContent = '▶'; }); }
  if (btn.classList.contains('playing')) { previewAudio = null; return; }
  previewAudio = new Audio(url);
  previewAudio.play();
  btn.classList.add('playing');
  btn.textContent = '⏸';
  previewAudio.onended = () => { btn.classList.remove('playing'); btn.textContent = '▶'; previewAudio = null; };
}

/* ===== VIDEO PLAYER ===== */
function togglePlayer() {
  const wrap = document.getElementById('playerWrap');
  const iframe = document.getElementById('videoPlayer');
  if (wrap.classList.contains('hidden')) {
    iframe.src = `https://www.vidking.net/embed/movie/${modalMovieId}`;
    wrap.classList.remove('hidden');
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    iframe.src = '';
    wrap.classList.add('hidden');
  }
}

async function loadEpisodes() {
  const season = document.getElementById('seasonSelect').value;
  const epSelect = document.getElementById('episodeSelect');
  try {
    const data = await tmdb(`/tv/${modalMovieId}/season/${season}`);
    const eps = data.episodes || [];
    epSelect.innerHTML = eps.map(e => `<option value="${e.episode_number}">Ep ${e.episode_number} — ${e.name || ''}</option>`).join('');
    if (!eps.length) epSelect.innerHTML = '<option value="1">Episode 1</option>';
  } catch {
    epSelect.innerHTML = '<option value="1">Episode 1</option>';
  }
}

function playEpisode() {
  const season = document.getElementById('seasonSelect').value;
  const episode = document.getElementById('episodeSelect').value;
  const wrap = document.getElementById('playerWrap');
  const iframe = document.getElementById('videoPlayer');
  iframe.src = `https://www.vidking.net/embed/tv/${modalMovieId}/${season}/${episode}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`;
  wrap.classList.remove('hidden');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function selectRating(val, el) {
  selectedRating = val;
  document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function submitReview() {
  if (!selectedRating) { showNotif('Pehle rating select karo! 😤'); return; }
  const text = document.getElementById('reviewText').value.trim();
  const r = RATINGS.find(r => r.val === selectedRating);
  const review = { val: r.val, label: r.label, emoji: r.emoji, text, date: new Date().toLocaleDateString('en-IN') };
  const reviews = getReviews(modalMovieId);
  reviews.unshift(review);
  localStorage.setItem(`bka_reviews_${modalMovieId}`, JSON.stringify(reviews));
  document.getElementById('pastReviews').innerHTML = reviews.map(renderReviewCard).join('');
  document.getElementById('reviewText').value = '';
  selectedRating = null;
  document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
  showNotif(`${r.emoji} Review saved — ${r.label}!`);
  refreshGrid();
}

function renderReviewCard(r, i) {
  return `<div class="review-card"><div class="rc-top"><span class="rc-rating" style="color:${RATINGS.find(x=>x.val===r.val)?.color||'#fff'}">${r.emoji} ${r.label}</span><span class="rc-date">${r.date}</span></div>${r.text ? `<p class="rc-text">${r.text}</p>` : ''}<button class="rc-delete" onclick="deleteReview(${i})">Delete</button></div>`;
}

function deleteReview(idx) {
  const reviews = getReviews(modalMovieId);
  reviews.splice(idx, 1);
  localStorage.setItem(`bka_reviews_${modalMovieId}`, JSON.stringify(reviews));
  document.getElementById('pastReviews').innerHTML = reviews.map(renderReviewCard).join('');
  showNotif('Review deleted 🗑️'); refreshGrid();
}

function getReviews(id) { try { return JSON.parse(localStorage.getItem(`bka_reviews_${id}`) || '[]'); } catch { return []; } }
function getUserRating(id) { const r = getReviews(id); return r.length ? RATINGS.find(x => x.val === r[0].val) || null : null; }

async function refreshGrid() {
  currentPage = 1;
  if (activeGenre) { const d = await tmdb('/discover/movie', { with_genres: activeGenre, page: 1 }); renderGrid(d.results || [], false); }
  else { await loadTrending(); }
}

function closeModal() {
  const iframe = document.getElementById('videoPlayer');
  if (iframe) iframe.src = '';
  document.getElementById('modalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  selectedRating = null;
}
function closeModalOnOverlay(e) { if (e.target === document.getElementById('modalOverlay')) closeModal(); }

/* ===== UTILS ===== */
function goHome() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function scrollToMovies() { document.getElementById('moviesSection').scrollIntoView({ behavior: 'smooth' }); }
function showNotif(msg) {
  const n = document.getElementById('notification');
  n.textContent = msg; n.classList.remove('hidden');
  setTimeout(() => n.classList.add('hidden'), 2500);
}
