/* ===== BerojgaroKaAdda — App Logic ===== */
let API_KEY = '4634702dba260b11258a3728ef929257';
const OMDB_KEY = 'trilogy';          // free OMDb key (no account needed)
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const OMDB_BASE = 'https://www.omdbapi.com/';

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

  const params = new URLSearchParams(window.location.search);
  const movieId = params.get('id') || localStorage.getItem('bka_nav_id');
  const type = params.get('type') || localStorage.getItem('bka_nav_type') || 'movie';

  // If the movie page specific element exists, we are on movie.html
  if (document.getElementById('modalHero')) {
    if (movieId) {
      await loadMoviePage(movieId, type);
    } else {
      document.getElementById('modalHero').innerHTML = '<h2 style="padding:40px;text-align:center">Movie not found. Please go back to the homepage.</h2>';
    }
  } else if (document.getElementById('moviesGrid')) {
    // Otherwise we are on the homepage
    await loadAll();
  }
}

async function loadAll() {
  await loadGenres();
  await loadTrending();
  await loadHero();
  renderGenreSpotlight();   // sync — uses predefined data
  loadIndianCinema();        // async non-blocking
}

/* ===== PARTICLES ===== */
function createParticles() {
  const c = document.getElementById('particles');
  if (!c) return;
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const s = Math.random() * 4 + 2;
    p.style.cssText = `width:${s}px;height:${s}px;left:${Math.random() * 100}%;animation-duration:${Math.random() * 15 + 10}s;animation-delay:${Math.random() * 10}s;`;
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
  if (!c) return;
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
  let params = { page: currentPage };

  if (mediaType === 'movie') path = '/trending/movie/week';
  else if (mediaType === 'tv') path = '/trending/tv/week';
  else if (mediaType === 'india') {
    path = '/discover/movie';
    params = { ...params, with_original_language: 'hi|te|ml|ta|kn', sort_by: 'popularity.desc', 'vote_count.gte': 20 };
  }

  // If "all" and page 1, mix in some Indian movies explicitly
  if (mediaType === 'all' && currentPage === 1) {
    const [globalData, indianData] = await Promise.all([
      tmdb('/trending/all/week', { page: 1 }),
      tmdb('/discover/movie', { with_original_language: 'hi|te|ml|ta|kn', sort_by: 'popularity.desc', 'vote_count.gte': 30 })
    ]);

    const combined = [...(globalData.results || []).slice(0, 12), ...(indianData.results || []).slice(0, 8)];
    // Shuffle combined results
    const shuffled = combined.sort(() => Math.random() - 0.5);
    renderGrid(shuffled, false);
    return;
  }

  const data = await tmdb(path, params);
  renderGrid(data.results || [], currentPage > 1);
}

function setMediaType(type, el) {
  mediaType = type; currentPage = 1;
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  activeGenre = null;
  document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
  document.querySelector('.genre-pill')?.classList.add('active');
  document.getElementById('sectionTitle').textContent = type === 'india' ? '🇮🇳 Trending in India' : '🔥 Trending This Week';
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
    const card = document.createElement('div');
    card.className = 'movie-card animate-card';
    card.style.animationDelay = `${i * .06}s`;
    card.onclick = () => openModal(item.id, type);
    card.innerHTML = `
      <div class="card-poster">
        <img src="${IMG}w342${item.poster_path}" alt="${title}" loading="lazy"/>
        <span class="card-badge tmdb">⭐ ${vote}</span>
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
  // Fetch both Global Trending and Popular Indian Movies
  const [trending, indian] = await Promise.all([
    tmdb('/trending/movie/day'),
    tmdb('/discover/movie', { with_original_language: 'hi|te|ml|ta|kn', sort_by: 'popularity.desc' })
  ]);

  // Combine and shuffle slightly to mix them
  const combined = [...(trending.results || []).slice(0, 5), ...(indian.results || []).slice(0, 5)];
  heroMovies = combined.filter(m => m.backdrop_path).sort(() => Math.random() - 0.5).slice(0, 8);

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
    <div class="search-item-info"><h4>${title}</h4><p>${year} • ${type} • ⭐ ${(item.vote_average || 0).toFixed(1)}</p></div>
  </div>`;
}

/* ===== OMDB — Real IMDb + RT Ratings ===== */
async function fetchOmdbRatings(imdbId) {
  if (!imdbId) return null;
  try {
    const url = `${OMDB_BASE}?i=${imdbId}&apikey=${OMDB_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response === 'False') return null;
    const imdbRating = data.imdbRating !== 'N/A' ? data.imdbRating : null;
    const imdbVotes = data.imdbVotes !== 'N/A' ? data.imdbVotes : null;
    const metascore = data.Metascore !== 'N/A' ? data.Metascore : null;
    const rtRating = (data.Ratings || []).find(r => r.Source === 'Rotten Tomatoes');
    const rtScore = rtRating ? rtRating.Value : null; // e.g. "94%"
    return { imdbRating, imdbVotes, metascore, rtScore };
  } catch (e) { return null; }
}

/* ===== PAGE ROUTING ===== */
function openModal(id, type) {
  localStorage.setItem('bka_nav_id', id);
  localStorage.setItem('bka_nav_type', type || 'movie');
  window.location.href = `movie.html?id=${id}&type=${type || 'movie'}`;
}

async function loadMoviePage(id, type) {
  modalMovieId = id; modalMediaType = type || 'movie';
  const dd = document.getElementById('searchDropdown');
  if (dd) dd.classList.add('hidden');

  try {
    const [detail, credits, providers] = await Promise.all([
      tmdb(`/${type}/${id}`, { append_to_response: 'external_ids' }),
      tmdb(`/${type}/${id}/credits`),
      tmdb(`/${type}/${id}/watch/providers`)
    ]);

    renderModal(detail, credits, providers);

    // Fetch real IMDb + RT ratings async (non-blocking)
    const imdbId = detail.external_ids?.imdb_id || detail.imdb_id || '';
    if (imdbId) {
      fetchOmdbRatings(imdbId).then(omdb => {
        if (omdb) injectOmdbRatings(omdb, imdbId, detail.vote_average);
      });
    }

    document.title = (detail.title || detail.name || 'Movie') + ' - BerojgaroKaAdda';
    window.scrollTo(0, 0);
  } catch (error) {
    console.error('Error loading movie:', error);
    const mb = document.getElementById('modalBody');
    if (mb) mb.innerHTML = '<div style="padding:40px;text-align:center;">Failed to load movie details.</div>';
  }
}

function injectOmdbRatings(omdb, imdbId, tmdbVote) {
  const box = document.getElementById('omdbRatingsBox');
  if (!box) return;
  let html = '';

  // 1. Tomatometer (Critics)
  if (omdb.rtScore) {
    const pct = parseInt(omdb.rtScore);
    const fresh = pct >= 60;
    html += `<div class="score-card omdb-card" title="Rotten Tomatoes Tomatometer: ${omdb.rtScore}">
      <div class="sc-val omdb-rt">${fresh ? '🍅' : '🤢'} ${omdb.rtScore}</div>
      <div class="sc-label">Tomatometer</div>
      <div class="sc-sublabel">${fresh ? 'Fresh' : 'Rotten'}</div>
    </div>`;
  } else {
    html += `<div class="score-card omdb-card"><div class="sc-val">N/A</div><div class="sc-label">Tomatometer</div></div>`;
  }

  // 2. Popcorn Meter (Audience)
  const fanScore = tmdbVote ? Math.round(tmdbVote * 10) + '%' : '—';
  const fanFresh = tmdbVote >= 6;
  html += `<div class="score-card omdb-card" title="Audience Score (Popcorn Meter)">
    <div class="sc-val omdb-fans">${fanFresh ? '🍿' : '💩'} ${fanScore}</div>
    <div class="sc-label">Popcorn Meter</div>
    <div class="sc-sublabel">${fanFresh ? 'Fresh' : 'Stale'}</div>
  </div>`;

  // 3. IMDb Score
  if (omdb.imdbRating) {
    html += `<div class="score-card omdb-card" title="IMDb User Rating">
      <div class="sc-val omdb-imdb">⭐ ${omdb.imdbRating}</div>
      <div class="sc-label">IMDb Rating</div>
    </div>`;
  }

  if (html) {
    box.innerHTML = html;
    box.style.animation = 'fadeIn .5s ease';
  }
}

function renderModal(d, credits, prov) {
  const title = d.title || d.name || '';
  const year = (d.release_date || d.first_air_date || '').slice(0, 4);
  const runtime = d.runtime ? `${d.runtime} min` : (d.episode_run_time?.[0] ? `${d.episode_run_time[0]} min/ep` : '');
  const genreNames = (d.genres || []).map(g => g.name).join(', ');
  const vote = d.vote_average ? d.vote_average.toFixed(1) : '—';
  const imdbId = d.external_ids?.imdb_id || d.imdb_id || '';
  const backdrop = d.backdrop_path ? `${IMG}original${d.backdrop_path}` : '';

  window.currentMovieData = {
    id: modalMovieId,
    title: title,
    poster: d.poster_path ? `${IMG}w342${d.poster_path}` : '',
    mediaType: modalMediaType
  };

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
  html += `<div class="mb-section"><h3>📊 Scores & Ratings</h3>
    <div class="scores-row">
      <div class="score-card"><div class="sc-val gold">${vote}</div><div class="sc-label">TMDB Score</div></div>
      <div class="score-card"><div class="sc-val green">${d.vote_count || 0}</div><div class="sc-label">Votes</div></div>
      ${d.popularity ? `<div class="score-card"><div class="sc-val">${Math.round(d.popularity)}</div><div class="sc-label">Popularity</div></div>` : ''}
    </div>
    <div class="scores-row omdb-ratings-row" id="omdbRatingsBox" style="margin-top:10px">
      <div class="score-card omdb-skeleton"><div class="sc-val" style="font-size:.8rem;color:var(--text2)">⭐ Loading…</div><div class="sc-label">IMDb Rating</div></div>
      <div class="score-card omdb-skeleton"><div class="sc-val" style="font-size:.8rem;color:var(--text2)">🍅 Loading…</div><div class="sc-label">Rotten Tomatoes</div></div>
    </div>
  </div>`;
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
  const allProv = [...(inProv?.flatrate || []), ...(inProv?.rent || []), ...(inProv?.buy || [])];
  const uniqueProv = [...new Map(allProv.map(p => [p.provider_id, p])).values()].slice(0, 8);
  if (uniqueProv.length) {
    html += `<div class="mb-section"><h3>📺 Where to Watch</h3><div class="providers-row">${uniqueProv.map(p => `
      <div class="provider-chip"><img src="${IMG}w45${p.logo_path}" alt="${p.provider_name}"/><span>${p.provider_name}</span></div>`).join('')}</div></div>`;
  }

  // Rating
  html += `<div class="rating-section"><h3 style="color:var(--gold);margin-bottom:14px">⭐ Rate — Apne Andaaz Mein</h3>
    <div class="rating-options">${RATINGS.map(r => `<button class="rating-btn" data-val="${r.val}" onclick="selectRating(${r.val},this)" style="--rc:${r.color}">${r.emoji} ${r.label}</button>`).join('')}</div>
    <textarea class="review-textarea" id="reviewText" placeholder="Apni raay likho..."></textarea>
    <button class="submit-review" onclick="submitReview()">Submit Review ✨</button>
    
    <!-- Cloud Reviews Container -->
    <div id="cloudReviewsContainer" style="margin-top: 30px;">
      <div style="text-align:center; padding: 20px; color: var(--text-muted);">Loading community reviews...</div>
    </div>
  </div>`;
  document.getElementById('modalBody').innerHTML = html;

  loadAndRenderCloudReviews(modalMovieId);

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
  } catch (e) { }

  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(movieName + ' soundtrack')}&media=music&entity=song&limit=10`);
    if (res.ok) {
      const json = await res.json();
      const songs = (json.results || []).filter(s => s.kind === 'song');
      if (songs.length) { renderItunesSongs(songs, movieName); return; }
    }
  } catch (e) { }

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
    iframe.src = `https://www.vidking.net/embed/movie/${modalMovieId}?color=e50914&autoPlay=true`;
    wrap.classList.remove('hidden');
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (window.saveWatchHistory && window.currentMovieData) {
      window.saveWatchHistory(window.currentMovieData);
    }
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
  if (window.saveWatchHistory && window.currentMovieData) {
    window.saveWatchHistory({
      ...window.currentMovieData,
      season: season,
      episode: episode
    });
  }
}

/* ===== INDIAN CINEMA HUB & GENRE SPOTLIGHT ===== */

async function loadIndianCinema() {
  const today = new Date().toISOString().split('T')[0]; // 2026-05-15

  // 1. Bollywood (Hindi) - Popular Recent
  tmdb('/discover/movie', {
    with_original_language: 'hi',
    region: 'IN',
    sort_by: 'popularity.desc',
    'primary_release_date.lte': today,
    'vote_count.gte': 5
  }).then(data => renderCinemaScroll('bollywoodScroll', data.results || []));

  // 2. Tollywood (Telugu) - Popular Recent
  tmdb('/discover/movie', {
    with_original_language: 'te',
    region: 'IN',
    sort_by: 'popularity.desc',
    'primary_release_date.lte': today,
    'vote_count.gte': 5
  }).then(data => renderCinemaScroll('tollywoodScroll', data.results || []));

  // 3. Mollywood (Malayalam) - Popular Recent
  tmdb('/discover/movie', {
    with_original_language: 'ml',
    region: 'IN',
    sort_by: 'popularity.desc',
    'primary_release_date.lte': today,
    'vote_count.gte': 5
  }).then(data => renderCinemaScroll('mollywoodScroll', data.results || []));

  // 4. Recent Indian (Latest 2026 releases)
  tmdb('/discover/movie', {
    with_original_language: 'hi|te|ml|ta|kn',
    region: 'IN',
    sort_by: 'primary_release_date.desc',
    'primary_release_date.lte': today,
    'vote_count.gte': 2
  }).then(data => renderCinemaScroll('recentIndianScroll', (data.results || []).slice(0, 15), true));
}

function renderCinemaScroll(id, items, isNew = false) {
  const container = document.getElementById(id);
  if (!container) return;
  if (!items.length) { container.innerHTML = '<div class="cs-loading">No movies found.</div>'; return; }

  container.innerHTML = items.map(item => {
    const title = item.title || item.name;
    const year = (item.release_date || '').slice(0, 4);
    const vote = item.vote_average ? item.vote_average.toFixed(1) : '—';
    return `
      <div class="cinema-card" onclick="openModal(${item.id}, 'movie')">
        <div class="cc-poster">
          <img src="${IMG}w185${item.poster_path}" alt="${title}" class="cc-img" loading="lazy"/>
          <span class="cc-vote">⭐ ${vote}</span>
          ${isNew ? '<span class="cc-new">New</span>' : ''}
        </div>
        <div class="cc-info">
          <div class="cc-title">${title}</div>
          <div class="cc-year">${year}</div>
        </div>
      </div>`;
  }).join('');
}

function renderGenreSpotlight() {
  const spotlightGrid = document.getElementById('genreVisualGrid');
  if (!spotlightGrid) return;

  const visualGenres = [
    { name: 'Action', emoji: '💥', color: 'linear-gradient(135deg, #ff416c, #ff4b2b)' },
    { name: 'Comedy', emoji: '😂', color: 'linear-gradient(135deg, #fcebb1, #f1bb3a)' },
    { name: 'Horror', emoji: '👻', color: 'linear-gradient(135deg, #232526, #414345)' },
    { name: 'Romance', emoji: '💖', color: 'linear-gradient(135deg, #ff9a9e, #fecfef)' },
    { name: 'Sci-Fi', emoji: '🚀', color: 'linear-gradient(135deg, #00d2ff, #3a7bd5)' },
    { name: 'Thriller', emoji: '🗡️', color: 'linear-gradient(135deg, #1f4037, #99f2c8)' },
    { name: 'Animation', emoji: '🎨', color: 'linear-gradient(135deg, #eecda3, #ef629f)' },
    { name: 'Drama', emoji: '🎭', color: 'linear-gradient(135deg, #304352, #d7d2cc)' }
  ];

  spotlightGrid.innerHTML = visualGenres.map(g => `
    <div class="genre-vis-card" style="background: ${g.color}" onclick="filterGenreByName('${g.name}')">
      <span class="gv-emoji">${g.emoji}</span>
      <span class="gv-name">${g.name}</span>
    </div>
  `).join('');
}

function filterGenreByName(name) {
  const genre = genres.find(g => g.name.toLowerCase() === name.toLowerCase());
  if (genre) {
    // Find the genre pill and click it
    const pills = document.querySelectorAll('.genre-pill');
    pills.forEach(p => {
      if (p.textContent.includes(name)) {
        filterGenre(genre.id, p);
        scrollToMovies();
      }
    });
  }
}

async function filterByLang(lang, label) {
  activeGenre = null;
  document.getElementById('sectionTitle').textContent = `🇮🇳 ${label}`;
  document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
  document.querySelector('.genre-pill')?.classList.add('active'); // "All" pill

  currentPage = 1;
  const data = await tmdb('/discover/movie', { with_original_language: lang, sort_by: 'popularity.desc', page: 1 });
  renderGrid(data.results || [], false);
  scrollToMovies();
}

function selectRating(val, el) {
  selectedRating = val;
  document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

async function submitReview() {
  const user = window.getCurrentUser ? window.getCurrentUser() : null;
  if (!user) { showNotif('Pehle Sign In karo! 🔐'); return; }
  
  if (!user.customUsername) {
    if (window.promptForUsername) {
      window.promptForUsername();
      showNotif('Pick your Adda Name first!');
    }
    return;
  }

  if (!selectedRating) { showNotif('Pehle rating select karo! 😤'); return; }
  
  const text = document.getElementById('reviewText').value.trim();
  const r = RATINGS.find(r => r.val === selectedRating);
  const reviewData = { val: r.val, label: r.label, emoji: r.emoji, text, date: new Date().toLocaleDateString('en-IN') };
  
  const btn = document.querySelector('.submit-review');
  btn.innerHTML = 'Submitting...';
  btn.disabled = true;

  const success = await window.submitCloudReview(modalMovieId, reviewData);
  if (success) {
    document.getElementById('reviewText').value = '';
    selectedRating = null;
    document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
    showNotif(`${r.emoji} Review saved — ${r.label}!`);
    await loadAndRenderCloudReviews(modalMovieId);
  } else {
    showNotif('Error submitting review. Please try again.');
  }
  
  btn.innerHTML = 'Submit Review ✨';
  btn.disabled = false;
}

async function loadAndRenderCloudReviews(id) {
  const container = document.getElementById('cloudReviewsContainer');
  if (!container || !window.loadCloudReviews) return;
  
  const reviews = await window.loadCloudReviews(id);
  
  if (reviews.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">No reviews yet. Be the first!</div>';
    return;
  }

  // Calculate Distribution
  const counts = { 5:0, 4:0, 3:0, 2:0, 1:0 };
  reviews.forEach(r => { if(counts[r.val] !== undefined) counts[r.val]++; });
  const total = reviews.length;

  let distHtml = '<div class="review-distribution" style="margin-bottom: 20px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">';
  distHtml += `<h4 style="margin-bottom: 10px; font-size: 1rem;">Community Ratings (${total})</h4>`;
  RATINGS.forEach(r => {
    const c = counts[r.val];
    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
    distHtml += `
      <div style="display: flex; align-items: center; margin-bottom: 5px; font-size: 0.85rem;">
        <span style="width: 120px; color: var(--text-muted);">${r.emoji} ${r.label}</span>
        <div style="flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin: 0 10px; overflow: hidden;">
          <div style="height: 100%; width: ${pct}%; background: ${r.color}; border-radius: 4px;"></div>
        </div>
        <span style="width: 30px; text-align: right; color: ${r.color}; font-weight: 600;">${c}</span>
      </div>
    `;
  });
  distHtml += '</div>';

  const reviewsHtml = '<div class="past-reviews">' + reviews.map(r => `
    <div class="review-card" style="margin-bottom: 15px; padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px;">
      <div class="rc-top" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width:30px; height:30px; background: var(--primary); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem;">
            ${r.username.charAt(0).toUpperCase()}
          </div>
          <span style="font-weight: 600;">${r.username}</span>
          <span style="color:${RATINGS.find(x => x.val === r.val)?.color || '#fff'}; font-size: 0.9rem;">${r.emoji} ${r.label}</span>
        </div>
        <span style="color: var(--text-muted); font-size: 0.8rem;">${r.date}</span>
      </div>
      ${r.text ? `<p style="margin: 0; color: #ddd; font-size: 0.9rem; line-height: 1.5;">${r.text}</p>` : ''}
    </div>
  `).join('') + '</div>';

  container.innerHTML = distHtml + reviewsHtml;
}

async function refreshGrid() {
  currentPage = 1;
  if (activeGenre) { const d = await tmdb('/discover/movie', { with_genres: activeGenre, page: 1 }); renderGrid(d.results || [], false); }
  else { await loadTrending(); }
}

function closeModal() {
  const iframe = document.getElementById('videoPlayer');
  if (iframe) iframe.src = '';
  div.innerHTML = `<div>⭐ ${rating}</div>`;
  div.classList.add('review-toast');
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2000);
}

/* ===== CONTINUE WATCHING ===== */
window.renderContinueWatching = function(history) {
  const section = document.getElementById('continueWatchingSection');
  const scroll = document.getElementById('continueWatchingScroll');
  
  if (!section || !scroll) return;
  
  if (!history || history.length === 0) {
    section.classList.add('hidden');
    scroll.innerHTML = '';
    return;
  }
  
  section.classList.remove('hidden');
  
  scroll.innerHTML = history.map(item => {
    const isTv = item.mediaType === 'tv';
    const epBadge = isTv && item.season ? `<div class="cw-badge">S${item.season} E${item.episode}</div>` : '';
    
    // The click handler redirects to movie.html (or auto-plays episode logic)
    return `
      <div class="cinema-card" onclick="openModal(${item.id}, '${item.mediaType}')">
        <img src="${item.poster || 'data:image/svg+xml,<svg/>'}" alt="${item.title}" loading="lazy"/>
        ${epBadge}
        <div class="cinema-card-info">
          <h4>${item.title}</h4>
        </div>
      </div>
    `;
  }).join('');
};
function closeModalOnOverlay(e) { if (e.target === document.getElementById('modalOverlay')) closeModal(); }

/* ===== SIMILAR MOVIE FINDER LOGIC ===== */

async function findSimilarMovies() {
  const input = document.getElementById('aiSearchInput');
  const query = input.value.trim();
  const resultsContainer = document.getElementById('aiResults');

  if (!query) { showNotif('Please enter a movie name! 🎬'); return; }

  resultsContainer.classList.remove('hidden');
  resultsContainer.innerHTML = '<div class="loader"></div>';

  try {
    // 1. Search for the movie to get ID
    const searchData = await tmdb('/search/movie', { query });
    if (!searchData.results?.length) {
      resultsContainer.innerHTML = '<div class="ai-no-results">No movie found with that name. Try again! 🧐</div>';
      return;
    }

    const movie = searchData.results[0];
    const movieId = movie.id;

    // 2. Get Credits (Director & Lead Actor)
    const credits = await tmdb(`/movie/${movieId}/credits`);
    const director = credits.crew.find(c => c.job === 'Director');
    const leadActor = credits.cast[0];

    // 3. Fetch Recommendations in Parallel
    const [recs, actorMovies, directorMovies] = await Promise.all([
      tmdb(`/movie/${movieId}/recommendations`),
      leadActor ? tmdb('/discover/movie', { with_cast: leadActor.id, sort_by: 'popularity.desc' }) : Promise.resolve({ results: [] }),
      director ? tmdb('/discover/movie', { with_crew: director.id, sort_by: 'popularity.desc' }) : Promise.resolve({ results: [] })
    ]);

    // 4. Render Rows
    let html = `
      <div class="ai-movie-source" style="padding:20px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid var(--border);">
        <p style="font-size:0.8rem; color:var(--gold); margin-bottom:5px;">Recommendations based on:</p>
        <h3 style="font-size:1.4rem;">${movie.title}</h3>
      </div>
    `;

    // Category: Recommendations (Genre/Type)
    if (recs.results?.length) {
      html += `
        <div class="cinema-section">
          <div class="ai-row-title">🤖 Based on <span>Movie Type & Vibe</span></div>
          <div class="cinema-scroll" id="aiRecScroll"></div>
        </div>
      `;
    }

    // Category: Actor
    if (actorMovies.results?.length > 1) {
      html += `
        <div class="cinema-section">
          <div class="ai-row-title">🎭 More from Lead Actor: <span>${leadActor.name}</span></div>
          <div class="cinema-scroll" id="aiActorScroll"></div>
        </div>
      `;
    }

    // Category: Director
    if (directorMovies.results?.length > 1) {
      html += `
        <div class="cinema-section">
          <div class="ai-row-title">🎬 From the Director: <span>${director.name}</span></div>
          <div class="cinema-scroll" id="aiDirectorScroll"></div>
        </div>
      `;
    }

    resultsContainer.innerHTML = html;

    // Render the actual scrolls
    if (recs.results?.length) renderCinemaScroll('aiRecScroll', recs.results.slice(0, 10));
    if (actorMovies.results?.length > 1) renderCinemaScroll('aiActorScroll', actorMovies.results.filter(m => m.id !== movieId).slice(0, 10));
    if (directorMovies.results?.length > 1) renderCinemaScroll('aiDirectorScroll', directorMovies.results.filter(m => m.id !== movieId).slice(0, 10));

    resultsContainer.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    resultsContainer.innerHTML = '<div class="ai-no-results">Something went wrong. Please try again! 🔴</div>';
  }
}

/* ===== UTILS ===== */
function goHome() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function scrollToMovies() { document.getElementById('moviesSection').scrollIntoView({ behavior: 'smooth' }); }
function scrollToAI() { document.getElementById('aiSuggestions').scrollIntoView({ behavior: 'smooth' }); }
function showNotif(msg) {
  const n = document.getElementById('notification');
  n.textContent = msg; n.classList.remove('hidden');
  setTimeout(() => n.classList.add('hidden'), 2500);
}
