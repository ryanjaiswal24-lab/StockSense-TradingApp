/**
 * StockSense Core Frontend Logic
 * ─────────────────────────────────────────────
 * This file handles:
 *  - Firebase Initialization (Auth, RTDB, Functions)
 *  - Real-time Listeners for Market Data & AI Picks
 *  - UI Rendering (Portfolio, News, Dashboard)
 *  - Transaction Logic (Buy/Sell)
 *  - AI Chat Integration (Groq via Proxy)
 */

console.log("StockSense App Loading...");
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  get,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// Replace these placeholders with your real Firebase project values.
const firebaseConfig = {
  apiKey: "AIzaSyCbObdFKQlKp_5RsbnEw93oAFBYL3Cpp7c",
  authDomain: "stockscene-560d7.firebaseapp.com",
  databaseURL: "https://stockscene-560d7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "stockscene-560d7",
  storageBucket: "stockscene-560d7.firebasestorage.app",
  messagingSenderId: "432599841369",
  appId: "1:432599841369:web:54534225513a62859a0f48",
  measurementId: "G-BK3LQEX87Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);
const auth = getAuth(app);
const functions = getFunctions(app, "asia-south1");
const provider = new GoogleAuthProvider();

// GROQ AI CONFIGURATION
const GROQ_API_KEY = "";
const GROQ_MODEL = "llama-3.3-70b-versatile"; // Using Llama 3.3 Versatile for high-performance reasoning

const state = {
  user: null,
  stocks: {},
  livePrices: {},
  news: [],
  marketStatus: null,
  aiPicks: {},
  valuationPicks: {},
  valuationFilter: 'all',
  watchlist: {},
  portfolio: {},
  transactions: {},
  profile: {},
  earnings: {},
  fiidii: [],
  listenersStarted: false,
  newsLimit: 5,
  aiPicksLimit: 4,
  language: 'en',
  newsCategory: 'all'
};

const translations = {
  en: {
    nav_news: "News",
    nav_ai: "AI Picks",
    nav_live: "Live",
    nav_portfolio: "Portfolio",
    nav_profile: "Profile",
    market_label: "Market Intelligence",
    wealth_label: "Wealth Intelligence",
    ai_label: "Machine Learning",
    headlines_label: "Financial Headlines",
    portfolio_value: "Net Portfolio Value",
    daily_alpha: "Daily Alpha",
    days_profit: "Day's Profit",
    total_capital: "Total Capital",
    risk_profile: "Risk Profile",
    buying_power: "Buying Power",
    active_positions: "Active Positions",
    execute_trade: "Execute Trade",
    ai_smart_report: "AI Smart Report",
    news_search: "Search headlines...",
    live_sync: "LIVE SYNC",
    guest_name: "Guest Investor",
    save_profile: "Save Profile",
    language_label: "App Language"
  },
  hi: {
    nav_news: "समाचार",
    nav_ai: "AI सुझाव",
    nav_live: "लाइव मार्केट",
    nav_portfolio: "पोर्टफोलियो",
    nav_profile: "प्रोफ़ाइल",
    market_label: "मार्केट इंटेलिजेंस",
    wealth_label: "वेल्थ इंटेलिजेंस",
    ai_label: "मशीन लर्निंग",
    headlines_label: "वित्तीय समाचार",
    portfolio_value: "कुल पोर्टफोलियो मूल्य",
    daily_alpha: "दैनिक अल्फा",
    days_profit: "आज का लाभ",
    total_capital: "कुल पूंजी",
    risk_profile: "जोखिम प्रोफ़ाइल",
    buying_power: "खरीदने की शक्ति",
    active_positions: "सक्रिय निवेश",
    execute_trade: "ट्रेड निष्पादित करें",
    ai_smart_report: "AI स्मार्ट रिपोर्ट",
    news_search: "समाचार खोजें...",
    live_sync: "लाइव सिंक",
    guest_name: "अतिथि निवेशक",
    save_profile: "प्रोफ़ाइल सहेजें",
    language_label: "ऐप की भाषा"
  }
};

window.setLanguage = function(lang) {
  state.language = lang;
  localStorage.setItem("stocksense_lang", lang);
  updateLanguageUI();
  // Re-render sections to apply language changes
  renderNews();
  if (state.portfolio) renderPortfolio(state.portfolio);
  if (state.aiPicks) renderAIPicks(state.aiPicks);
};

window.filterNews = function(category) {
  state.newsCategory = category;
  state.newsLimit = 5; // Reset limit on filter change
  
  document.querySelectorAll("#news-categories-bar .ctrl-badge").forEach(el => {
    const isMatch = (category === 'all' && el.id === 'cat-all') || 
                    (category === 'Indian Market' && el.id === 'cat-indian') ||
                    (category === 'Global Market' && el.id === 'cat-global') ||
                    (category === 'Bullish' && el.id === 'cat-bullish') ||
                    (category === 'Bearish' && el.id === 'cat-bearish');
    
    el.classList.toggle("active", isMatch);
    if (isMatch) {
      if (category === 'Bullish') {
        el.style.background = "rgba(0, 255, 163, 0.2)";
        el.style.color = "var(--accent)";
        el.style.borderColor = "var(--accent)";
      } else if (category === 'Bearish') {
        el.style.background = "rgba(255, 77, 77, 0.2)";
        el.style.color = "var(--danger)";
        el.style.borderColor = "var(--danger)";
      } else {
        el.style.background = "var(--accent)";
        el.style.color = "#000";
        el.style.borderColor = "var(--accent)";
      }
    } else {
      el.style.background = "";
      el.style.color = "";
      el.style.borderColor = "";
    }
  });
  renderNews();
};

function updateLanguageUI() {
  const t = translations[state.language];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });
  
  // Update placeholders
  const newsInput = document.getElementById("news-input");
  if (newsInput) newsInput.placeholder = t.news_search;
}

const authGate = document.getElementById("authGate");
const appShell = document.getElementById("appShell");
const loginBtn = document.getElementById("loginBtn");
const gateLoginBtn = document.getElementById("gateLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authStatus = document.getElementById("authStatus");
const picksGrid = document.getElementById("picksGrid");
const liveGrid = document.getElementById("liveGrid");
const newsGrid = document.getElementById("newsGrid");
const marketPhase = document.getElementById("marketPhase");
const marketSummary = document.getElementById("marketSummary");
const trackedCount = document.getElementById("trackedCount");
const lastRefresh = document.getElementById("lastRefresh");
const profilePic = document.getElementById("profile-pic");
const profileName = document.getElementById("profile-name");
const profileEmail = document.getElementById("profile-email");
const headerProfilePic = document.getElementById("profile-card-pic");
const headerProfileName = document.getElementById("profile-card-name");
const headerProfileEmail = document.getElementById("profile-card-email");
const profilePill = document.getElementById("profile-pill");
const displayNameInput = document.getElementById("displayNameInput");
const themeAccentInput = document.getElementById("themeAccentInput");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const profileSaveStatus = document.getElementById("profileSaveStatus");
const portTicker = document.getElementById("port-ticker");
const portQty = document.getElementById("port-qty");
const portBuyPrice = document.getElementById("port-buy-price");
const btnPortAdd = document.getElementById("btn-port-add");
const portTbody = document.getElementById("port-tbody");
const pmInvested = document.getElementById("pm-invested");
const pmCurrent = document.getElementById("pm-current");
const pmPnL = document.getElementById("pm-pnl");
const pmDayGain = document.getElementById("pm-daygain");
const indexBar = document.getElementById("index-bar");
const liveSearch = document.getElementById("live-search");
const btnLiveSearch = document.getElementById("btn-live-search");
const liveCount = document.getElementById("live-count");
const liveTablesContainer = document.getElementById("live-tables-container");
const aiGrid = document.getElementById("aiGrid");
const newsInput = document.getElementById("news-input");
const btnNewsClear = document.getElementById("btn-news-clear");
const topGainers = document.getElementById("top-gainers");
const topLosers = document.getElementById("top-losers");
const sectorGrid = document.getElementById("sector-grid");
const statGainers = document.getElementById("stat-gainers");
const statLosers = document.getElementById("stat-losers");
const statAvg = document.getElementById("stat-avg");
const btnChatToggle = document.getElementById("btn-chat-toggle");
const chatWindow = document.getElementById("chatWindow");
const btnCloseChat = document.getElementById("btnCloseChat");
const chatInput = document.getElementById("chatInput");
const btnSendChat = document.getElementById("btnSendChat");
const chatMessages = document.getElementById("chatMessages");

btnChatToggle?.addEventListener("click", () => chatWindow?.classList.toggle("hidden"));
btnCloseChat?.addEventListener("click", () => chatWindow?.classList.add("hidden"));

btnSendChat?.addEventListener("click", handleChat);
chatInput?.addEventListener("keypress", (e) => { if(e.key === 'Enter') handleChat(); });

function addChatMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.style.cssText = role === 'bot' 
    ? "background: var(--panel-strong); padding: 8px 12px; border-radius: 12px 12px 12px 0; max-width: 85%; align-self: flex-start; font-size: 0.9rem; white-space: pre-wrap;"
    : "background: var(--accent); color: #04100a; padding: 8px 12px; border-radius: 12px 12px 0 12px; max-width: 85%; align-self: flex-end; font-size: 0.9rem; font-weight: 600; white-space: pre-wrap;";
  div.textContent = text;
  chatMessages?.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function handleChat() {
  const text = chatInput.value.trim();
  if(!text) return;
  chatInput.value = "";
  addChatMessage("user", text);

  // Show thinking state
  const thinkingDiv = document.createElement("div");
  thinkingDiv.className = "msg bot thinking";
  thinkingDiv.style.cssText = "background: var(--panel-strong); padding: 8px 12px; border-radius: 12px 12px 12px 0; max-width: 85%; align-self: flex-start; font-size: 0.9rem; opacity: 0.6;";
  thinkingDiv.textContent = "Analyzing market data...";
  chatMessages?.appendChild(thinkingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const response = await getGroqChatResponse(text);
    thinkingDiv.remove();
    addChatMessage("bot", response);
  } catch (error) {
    thinkingDiv.textContent = "Sorry, my brain is foggy. Check your connection.";
    console.error("AI Error:", error);
  }
}

async function getGroqChatResponse(query) {
  const portfolio = Object.values(state.portfolio || {});
  const watchlist = Object.values(state.watchlist || {});
  
  // Optimization: Only send relevant prices to stay under token limits
  const relevantTickers = new Set([
    ...portfolio.filter(p => p && p.ticker).map(p => p.ticker.replace(".", "_")),
    ...watchlist.filter(w => w && w.ticker).map(w => w.ticker.replace(".", "_"))
  ]);
  
  // Add stock mentioned in query
  Object.keys(state.livePrices).forEach(ticker => {
    const symbol = ticker.split("_")[0].toLowerCase();
    if (query.toLowerCase().includes(symbol)) {
      relevantTickers.add(ticker);
    }
  });

  const filteredPrices = {};
  relevantTickers.forEach(t => {
    if (state.livePrices[t]) filteredPrices[t] = state.livePrices[t];
  });

  const news = state.news.slice(0, 5);
  
  const context = `
    You are StockSense AI, a professional financial advisor.
    USER PORTFOLIO: ${JSON.stringify(portfolio)}
    RELEVANT PRICES: ${JSON.stringify(filteredPrices)}
    LATEST NEWS: ${JSON.stringify(news)}
    MARKET STATUS: ${state.marketStatus?.phase || 'OPEN'}
    CURATED INTELLIGENCE SUGGESTIONS: ${JSON.stringify(state.curatedPicks || {})}
    
    Answer the user's question based on this data. If they ask about a stock in the curated recommendations (like Top Results Performers, Potential Future Stars, or Elite Dividend Yielders), give them a systematic and analytical explanation of why they are classified in that group. Always refer to this curated data to back up your suggestions.
  `;

  try {
    const chatProxy = httpsCallable(functions, 'chat_proxy');
    const result = await chatProxy({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: context },
        { role: "user", content: query }
      ],
      temperature: 0.6
    });

    if (result.data.error) throw new Error(result.data.error);
    return result.data.choices[0].message.content;
  } catch (err) {
    console.warn("Cloud Function failed, falling back to local proxy...", err);
    // Fallback to local Flask server if Cloud Function is not available
    const response = await fetch("http://127.0.0.1:5000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: context },
          { role: "user", content: query }
        ],
        temperature: 0.6
      })
    });
    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// Heuristic AI removed in favor of Groq


loginBtn?.addEventListener("click", async () => {
  if (authStatus) authStatus.textContent = "Opening Google sign-in...";
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    let msg = error.message;
    if (error.code === 'auth/operation-not-allowed') {
      msg = "Google login not enabled. Go to Firebase Console > Auth > Sign-in method and enable Google.";
    } else if (error.code === 'auth/unauthorized-domain') {
      msg = "Domain not authorized. Add your current URL to Firebase Console > Auth > Settings > Authorized Domains.";
    }
    if (authStatus) authStatus.textContent = msg;
    console.error("Login error:", error);
  }
});

gateLoginBtn?.addEventListener("click", async () => {
  console.log("Google Login Clicked");
  const gateAuthStatus = document.getElementById("gateAuthStatus");
  if (gateAuthStatus) gateAuthStatus.textContent = "Opening Google sign-in...";
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    let msg = error.message;
    if (error.code === 'auth/operation-not-allowed') {
      msg = "Google login not enabled. Enable it in Firebase Console.";
    } else if (error.code === 'auth/unauthorized-domain') {
      msg = "Domain not authorized. Add this domain in Firebase Console settings.";
    } else if (error.code === 'auth/popup-blocked') {
      msg = "Popup blocked! Please allow popups for this site or try Email login.";
    }
    if (gateAuthStatus) gateAuthStatus.textContent = "Error: " + msg;
    console.error("Login error:", error);
  }
});

// Form Toggles
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const showSignup = document.getElementById("showSignup");
const showLogin = document.getElementById("showLogin");

showSignup?.addEventListener("click", (e) => {
  e.preventDefault();
  loginForm?.classList.add("hidden");
  signupForm?.classList.remove("hidden");
});

showLogin?.addEventListener("click", (e) => {
  e.preventDefault();
  signupForm?.classList.add("hidden");
  loginForm?.classList.remove("hidden");
});

// Email Login
const emailLoginBtn = document.getElementById("emailLoginBtn");
emailLoginBtn?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPassword").value;
  const gateAuthStatus = document.getElementById("gateAuthStatus");

  if (!email || !pass) {
    if (gateAuthStatus) gateAuthStatus.textContent = "Please enter email and password.";
    return;
  }

  if (gateAuthStatus) gateAuthStatus.textContent = "Signing in...";
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (error) {
    if (gateAuthStatus) gateAuthStatus.textContent = "Error: " + error.message;
    console.error("Email login error:", error);
  }
});

// Email Signup
const emailSignupBtn = document.getElementById("emailSignupBtn");
emailSignupBtn?.addEventListener("click", async () => {
  const name = document.getElementById("signupName").value;
  const email = document.getElementById("signupEmail").value;
  const pass = document.getElementById("signupPassword").value;
  const gateAuthStatus = document.getElementById("gateAuthStatus");

  if (!name || !email || !pass) {
    if (gateAuthStatus) gateAuthStatus.textContent = "All fields are required.";
    return;
  }

  if (gateAuthStatus) gateAuthStatus.textContent = "Creating account...";
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
    // updateProfile doesn't trigger onAuthStateChanged with the new name immediately in some versions, 
    // but upsertUser will catch the email/uid.
    await upsertUser(userCredential.user);
  } catch (error) {
    if (gateAuthStatus) gateAuthStatus.textContent = "Error: " + error.message;
    console.error("Email signup error:", error);
  }
});

document.getElementById("guestLoginBtn")?.addEventListener("click", async () => {
  const gateAuthStatus = document.getElementById("gateAuthStatus");
  if (gateAuthStatus) gateAuthStatus.textContent = "Entering dashboard...";
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.error("Guest login failed:", error);
    if (authGate) authGate.classList.add("hidden");
    appShell?.classList.remove("hidden");
    startListeners();
  }
});

function getExpectedResultsHTML(ticker) {
  const safeKey = ticker.replace(".", "_");
  const earning = state.earnings[safeKey];
  const stock = state.stocks[safeKey] || {};
  const aiPick = state.aiPicks[safeKey] || {};
  
  let html = `<div class="tooltip-details" style="font-family: inherit;">`;
  if (earning) {
    const formattedDate = new Date(earning.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    html += `
      <div style="font-weight: 800; color: var(--info); margin-bottom: 8px; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px;">📅 Expected Results</div>
      <div style="margin-bottom: 4px; font-size: 0.78rem;"><span class="muted">Release Date:</span> <strong style="color: #fff;">${formattedDate}</strong></div>
      <div style="margin-bottom: 4px; font-size: 0.78rem;"><span class="muted">Revenue Est:</span> <strong style="color: #fff;">₹${formatVolume(earning.revenue_avg || 0)}</strong></div>
      <div style="margin-bottom: 4px; font-size: 0.78rem;"><span class="muted">EPS Est:</span> <strong style="color: #fff;">${earning.earnings_avg || 'N/A'}</strong></div>
      <div style="margin-bottom: 4px; font-size: 0.78rem;"><span class="muted">Expected Impact:</span> <span style="color: ${earning.expected_impact === 'High' ? 'var(--danger)' : 'var(--accent)'}; font-weight: 800;">${earning.expected_impact}</span></div>
    `;
  } else {
    html += `
      <div style="font-weight: 800; color: var(--accent); margin-bottom: 8px; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px;">📈 Technical Pulse</div>
      <div style="margin-bottom: 4px; font-size: 0.78rem;"><span class="muted">Trend Score:</span> <strong style="color: var(--accent);">${aiPick.score || stock.ml || 'N/A'}/100</strong></div>
      <div style="margin-bottom: 4px; font-size: 0.78rem;"><span class="muted">Fund Quality:</span> <strong style="color: var(--info);">${aiPick.quality_score || 'N/A'}/100</strong></div>
      <div style="margin-bottom: 4px; font-size: 0.78rem;"><span class="muted">Support:</span> <strong style="color: #fff;">₹${stock.sup || 'N/A'}</strong></div>
      <div style="margin-bottom: 4px; font-size: 0.78rem;"><span class="muted">Resistance:</span> <strong style="color: #fff;">₹${stock.res || 'N/A'}</strong></div>
    `;
  }
  html += `
    <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 8px; padding-top: 6px; font-size: 0.65rem; color: var(--muted); text-align: center; font-style: italic;">
      Click/Tap for source & full analysis
    </div>
  </div>`;
  return html;
}

window.showStockDetails = (ticker) => {
  const modal = document.getElementById("stockDetailsModal");
  if (!modal) return;

  const safeKey = ticker.replace(".", "_");
  const aiPick = state.aiPicks[safeKey] || {};
  const stock = state.stocks[safeKey] || {};

  const nameEl = document.getElementById("details-modal-name");
  const tickerEl = document.getElementById("details-modal-ticker");
  const sectorEl = document.getElementById("details-modal-sector");
  const trendEl = document.getElementById("details-modal-trend-val");
  const qualityEl = document.getElementById("details-modal-quality-val");
  const supportEl = document.getElementById("details-modal-support");
  const resistanceEl = document.getElementById("details-modal-resistance");
  const volatilityEl = document.getElementById("details-modal-volatility");
  const rangeEl = document.getElementById("details-modal-52w");
  const signalsEl = document.getElementById("details-modal-signals");
  const jumpBtn = document.getElementById("btn-details-jump");
  const sourceBtn = document.getElementById("btn-details-source");

  // Earnings details elements
  const earningContainer = document.getElementById("details-modal-earnings-container");
  const earningDateEl = document.getElementById("details-modal-earnings-date");
  const earningImpactEl = document.getElementById("details-modal-earnings-impact");
  const earningRevEl = document.getElementById("details-modal-earnings-rev");
  const earningEpsEl = document.getElementById("details-modal-earnings-eps");

  if (nameEl) nameEl.textContent = stock.name || aiPick.ticker || ticker;
  if (tickerEl) tickerEl.textContent = ticker;
  if (sectorEl) sectorEl.textContent = stock.sector || aiPick.sector || "Equity Market Asset";
  if (trendEl) trendEl.textContent = aiPick.score || stock.ml || 0;
  if (qualityEl) qualityEl.textContent = aiPick.quality_score || 0;
  
  if (supportEl) supportEl.textContent = stock.sup ? `₹${stock.sup}` : "₹" + ((stock.price || 0) * 0.95).toFixed(2);
  if (resistanceEl) resistanceEl.textContent = stock.res ? `₹${stock.res}` : "₹" + ((stock.price || 0) * 1.05).toFixed(2);
  if (volatilityEl) volatilityEl.textContent = stock.volatility ? `${stock.volatility}%` : (aiPick.volatility ? `${aiPick.volatility}%` : "N/A");
  
  const low52 = stock.w52_low || aiPick.w52_low || (stock.price ? stock.price * 0.8 : null);
  const high52 = stock.w52_high || aiPick.w52_high || (stock.price ? stock.price * 1.2 : null);
  if (rangeEl) rangeEl.textContent = (low52 && high52) ? `₹${low52.toFixed(2)} - ₹${high52.toFixed(2)}` : "N/A";

  // Expected Earnings display logic
  const earning = state.earnings[safeKey];
  if (earning && earningContainer) {
    earningContainer.classList.remove("hidden");
    if (earningDateEl) earningDateEl.textContent = new Date(earning.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (earningImpactEl) {
      earningImpactEl.textContent = earning.expected_impact;
      earningImpactEl.style.color = earning.expected_impact === "High" ? "var(--danger)" : "var(--accent)";
    }
    if (earningRevEl) earningRevEl.textContent = `₹${formatVolume(earning.revenue_avg || 0)}`;
    if (earningEpsEl) earningEpsEl.textContent = earning.earnings_avg || 'N/A';
  } else if (earningContainer) {
    earningContainer.classList.add("hidden");
  }

  if (signalsEl) {
    const reasons = aiPick.reasons || stock.signals || ["Technical Alignment"];
    signalsEl.innerHTML = reasons.map(r => `
      <span class="sig sig-b" style="font-size: 0.72rem; padding: 4px 10px; border-radius: 6px; background: rgba(0, 255, 163, 0.08); color: var(--accent); border: 1px solid rgba(0, 255, 163, 0.15);">${r}</span>
    `).join("");
  }

  if (jumpBtn) {
    jumpBtn.onclick = () => {
      modal.classList.add("hidden");
      window.jumpToStock(ticker);
    };
  }

  if (sourceBtn) {
    sourceBtn.href = `https://finance.yahoo.com/quote/${ticker}`;
  }

  modal.classList.remove("hidden");
};

document.getElementById("btn-details-close")?.addEventListener("click", () => {
  document.getElementById("stockDetailsModal")?.classList.add("hidden");
});
document.getElementById("btn-details-cancel")?.addEventListener("click", () => {
  document.getElementById("stockDetailsModal")?.classList.add("hidden");
});
document.getElementById("btn-suggest-more")?.addEventListener("click", () => {
  state.aiPicksLimit += 4;
  renderAIPicks();
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

saveProfileBtn?.addEventListener("click", async () => {
  if (!state.user) {
    if (profileSaveStatus) profileSaveStatus.textContent = "Log in first to save profile settings.";
    return;
  }

  const customName = displayNameInput.value.trim();
  const accent = themeAccentInput.value;

  try {
    await update(ref(db, `users/${state.user.uid}/profile`), {
      customName,
      themeAccent: accent,
      updatedAt: Date.now()
    });
    applyAccent(accent);
    profileSaveStatus.textContent = "Profile settings saved.";
  } catch (error) {
    profileSaveStatus.textContent = "Failed to save profile settings.";
    console.error("Profile save error:", error);
  }
});

// Transaction Modal Logic
window.openTxModal = function(type, ticker) {
  if (!state.user) {
    alert("Log in first to place orders.");
    return;
  }
  const modal = document.getElementById("txModal");
  const title = document.getElementById("tx-modal-title");
  const typeInput = document.getElementById("tx-type");
  const tickerInput = document.getElementById("tx-ticker");
  const qtyInput = document.getElementById("tx-qty");
  const priceInput = document.getElementById("tx-price");
  const availCash = document.getElementById("tx-avail-cash");
  const btnConfirm = document.getElementById("btn-tx-confirm");

  if (!modal) return;

  typeInput.value = type;
  tickerInput.value = ticker.replace("_", ".");
  qtyInput.value = 1;

  if (type === "buy") {
    title.textContent = "Buy Stock";
    btnConfirm.textContent = "Place Buy Order";
    btnConfirm.className = "btn btn-buy";
  } else {
    title.textContent = "Sell Stock";
    btnConfirm.textContent = "Place Sell Order";
    btnConfirm.className = "btn btn-sell";
  }

  availCash.textContent = formatCurrency(state.profile.availableBalance || 0);

  if (ticker) {
    const live = state.livePrices[ticker.replace(".", "_")];
    priceInput.value = live && live.price ? live.price : 0;
  } else {
    priceInput.value = "";
  }

  updateTxEstimate();
  modal.classList.remove("hidden");
};

document.getElementById("btn-tx-cancel")?.addEventListener("click", () => {
  document.getElementById("txModal")?.classList.add("hidden");
});

function updateTxEstimate() {
  const qty = Number(document.getElementById("tx-qty")?.value || 0);
  const price = Number(document.getElementById("tx-price")?.value || 0);
  const estVal = document.getElementById("tx-est-val");
  if (estVal) estVal.textContent = formatCurrency(qty * price);
}

document.getElementById("tx-qty")?.addEventListener("input", updateTxEstimate);
document.getElementById("tx-price")?.addEventListener("input", updateTxEstimate);

document.getElementById("btn-tx-confirm")?.addEventListener("click", async () => {
  if (!state.user) return;

  const type = document.getElementById("tx-type").value;
  const ticker = document.getElementById("tx-ticker").value.trim().toUpperCase();
  const qty = Number(document.getElementById("tx-qty").value);
  const price = Number(document.getElementById("tx-price").value);
  const safeTicker = ticker.replace(/[^a-zA-Z0-9]/g, '_');

  if (!ticker || qty <= 0 || price <= 0) {
    alert("Invalid order details.");
    return;
  }

  const orderValue = qty * price;
  const currentBalance = state.profile.availableBalance || 0;
  const holding = state.portfolio[safeTicker] || { qty: 0, buyPrice: 0 };

  let newBalance = currentBalance;
  let newQty = holding.qty;
  let newAvgPrice = holding.buyPrice;

  if (type === "buy") {
    if (orderValue > currentBalance) {
      alert("Insufficient funds.");
      return;
    }
    newBalance = currentBalance - orderValue;
    const totalInvested = (holding.qty * holding.buyPrice) + orderValue;
    newQty = holding.qty + qty;
    newAvgPrice = totalInvested / newQty;
  } else if (type === "sell") {
    if (qty > holding.qty) {
      alert("Insufficient quantity to sell.");
      return;
    }
    newBalance = currentBalance + orderValue;
    newQty = holding.qty - qty;
    // Avg price remains the same on sell
  }

  const txId = Date.now().toString();
  const txData = {
    type,
    ticker,
    qty,
    price,
    value: orderValue,
    timestamp: Date.now()
  };

  try {
    // 1. Log Transaction
    await set(ref(db, `users/${state.user.uid}/transactions/${txId}`), txData);
    
    // 2. Update Balance
    await update(ref(db, `users/${state.user.uid}/profile`), { availableBalance: newBalance });
    
    // 3. Update Portfolio
    if (newQty > 0) {
      await update(ref(db, `users/${state.user.uid}/portfolio/${safeTicker}`), {
        ticker,
        qty: newQty,
        buyPrice: newAvgPrice,
        updatedAt: Date.now()
      });
    } else {
      await set(ref(db, `users/${state.user.uid}/portfolio/${safeTicker}`), null);
    }

    document.getElementById("txModal").classList.add("hidden");
    // Show success toast (basic alert for now)
    alert(`Successfully ${type === 'buy' ? 'bought' : 'sold'} ${qty} shares of ${ticker}.`);
  } catch (error) {
    console.error("Transaction error:", error);
    alert("Transaction failed.");
  }
});

// Reset Portfolio Logic
window.resetPortfolio = async function() {
  if (!state.user) return;
  if (!confirm("Are you sure you want to reset your portfolio and funds to ₹2,00,000? This will delete all current holdings.")) return;

  try {
    await update(ref(db, `users/${state.user.uid}/profile`), { availableBalance: 200000 });
    await set(ref(db, `users/${state.user.uid}/portfolio`), null);
    await set(ref(db, `users/${state.user.uid}/transactions`), null);
    alert("Portfolio reset to ₹2,00,000 successfully.");
  } catch (err) {
    console.error("Reset failed:", err);
    alert("Failed to reset portfolio.");
  }
};

window.requestAITrain = async function(ticker) {
  if (!state.user) {
    alert("Log in first to request AI training.");
    return;
  }
  try {
    const btnId = `btn-train-${ticker.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const btn = document.getElementById(btnId);
    if (btn) btn.textContent = "Training...";
    
    const safeTicker = ticker.replace(/[^a-zA-Z0-9]/g, '_');
    await set(ref(db, `commands/train_model/${safeTicker}`), {
      ticker: ticker,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Train request error:", error);
    alert("Failed to request AI training.");
  }
};



document.querySelectorAll(".nav-pill, .mobile-nav-item").forEach((button) => {
  button.addEventListener("click", (e) => {
    // Check if it's an anchor tag before preventing default
    if (button.tagName === "A" && button.getAttribute("href")?.startsWith("#")) {
      e.preventDefault();
    }
    activateTab(button.dataset.tab);
  });
});

liveSearch?.addEventListener("input", renderDashboard);
btnLiveSearch?.addEventListener("click", renderDashboard);
newsInput?.addEventListener("input", renderNews);
btnNewsClear?.addEventListener("click", () => {
  if (newsInput) newsInput.value = "";
  renderNews();
});

onAuthStateChanged(auth, async (user) => {
  state.user = user;

  if (!user) {
    if (authGate) {
      authGate.classList.remove("hidden");
      appShell?.classList.add("hidden");
    } else {
      appShell?.classList.remove("hidden");
    }
    if (loginBtn) loginBtn.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (profilePill) profilePill.style.display = "none";
    if (authStatus) authStatus.textContent = "";
    setUserUI(null, null);
    startListeners();
    return;
  }

  if (authGate) {
    authGate.classList.add("hidden");
  }
  appShell?.classList.remove("hidden");
  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-flex";
  if (profilePill) profilePill.style.display = "flex";
  await upsertUser(user);
  const profilePrefs = await getUserProfile(user.uid);
  setUserUI(user, profilePrefs);
  startListeners();
});

function activateTab(tabName) {
  document.querySelectorAll(".nav-pill, .mobile-nav-item, .drawer-menu-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  document.querySelectorAll(".page-section").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `section-${tabName}`);
    if (panel.id === `section-${tabName}`) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

function startListeners() {
  if (state.listenersStarted) {
    return;
  }

  state.listenersStarted = true;

  onValue(ref(db, "stocks"), (snapshot) => {
    state.stocks = snapshot.val() || {};
    renderDashboard();
  });

  onValue(ref(db, "live_prices"), (snapshot) => {
    state.livePrices = snapshot.val() || {};
    renderDashboard();
  });

  onValue(ref(db, "news_cache"), (snapshot) => {
    state.news = snapshot.val() || [];
    renderNews();
  });

  onValue(ref(db, "market_status"), (snapshot) => {
    state.marketStatus = snapshot.val() || null;
    renderMarketStatus();
  });

  onValue(ref(db, "ai_picks"), (snapshot) => {
    state.aiPicks = snapshot.val() || {};
    renderAIPicks();
  });

  onValue(ref(db, "valuation_picks"), (snapshot) => {
    state.valuationPicks = snapshot.val() || {};
    renderValuationPicks();
  });

  onValue(ref(db, "market_indices"), (snapshot) => {
    const indices = snapshot.val() || {};
    renderIndexBar(indices);
  });

  onValue(ref(db, "ai_market_suggestion"), (snapshot) => {
    const data = snapshot.val() || null;
    renderAIMarketSuggestion(data);
  });

  onValue(ref(db, "market_intelligence/curated_picks"), (snapshot) => {
    state.curatedPicks = snapshot.val() || null;
    renderCuratedPicks();
  });

  if (state.user) {
    onValue(ref(db, `users/${state.user.uid}/portfolio`), (snapshot) => {
      state.portfolio = snapshot.val() || {};
      renderPortfolio(state.portfolio);
    });
    onValue(ref(db, `users/${state.user.uid}/watchlist`), (snapshot) => {
      state.watchlist = snapshot.val() || {};
      renderWatchlist();
    });
    onValue(ref(db, `users/${state.user.uid}/transactions`), (snapshot) => {
      state.transactions = snapshot.val() || {};
      renderTransactions();
    });
    onValue(ref(db, `users/${state.user.uid}/profile`), (snapshot) => {
      state.profile = snapshot.val() || {};
      if (state.profile.availableBalance === undefined) {
        state.profile.availableBalance = 200000; // Default: 2 Lakhs
        update(ref(db, `users/${state.user.uid}/profile`), { availableBalance: 200000 });
      }
      renderAvailableBalance();
    });
  }

  // New High-Frequency Listeners
  onValue(ref(db, "market_breadth"), (snapshot) => {
    const breadth = snapshot.val() || { gainers: 0, losers: 0 };
    if (statGainers) statGainers.textContent = breadth.gainers;
    if (statLosers) statLosers.textContent = breadth.losers;
  });

  onValue(ref(db, "market_sentiment"), (snapshot) => {
    const sent = snapshot.val() || { sentiment: "Neutral" };
    const summary = document.getElementById("marketSummary");
    if (summary) summary.textContent = `Sense: ${sent.sentiment} | Nifty: ${sent.change_pct?.toFixed(2) || 0}%`;
  });

  onValue(ref(db, "upcoming_results"), (snapshot) => {
    state.earnings = snapshot.val() || {};
    renderEarnings();
  });

  onValue(ref(db, "market_intelligence/fii_dii"), (snapshot) => {
    state.fiidii = snapshot.val() || [];
    renderFIIDII();
  });

  onValue(ref(db, "market_intelligence/commodities"), (snapshot) => {
    const commodities = snapshot.val() || {};
    renderCommodities(commodities);
  });
}

async function upsertUser(user) {
  await update(ref(db, `users/${user.uid}`), {
    email: user.email || "",
    photoURL: user.photoURL || "",
    displayName: user.displayName || "",
    lastLoginAt: Date.now()
  });
}

async function getUserProfile(uid) {
  try {
    const snapshot = await get(ref(db, `users/${uid}/profile`));
    return snapshot.exists() ? snapshot.val() : {};
  } catch (error) {
    console.error("Profile fetch error:", error);
    return {};
  }
}

async function loadPortfolio() {
  if (!state.user || !portTbody) {
    return;
  }

  try {
    const snapshot = await get(ref(db, `users/${state.user.uid}/portfolio`));
    const portfolio = snapshot.exists() ? snapshot.val() : {};
    state.portfolio = portfolio;
    renderPortfolio(portfolio);
  } catch (error) {
    console.error("Portfolio load error:", error);
  }
}

function renderPortfolio(portfolio) {
  if (!portTbody) return;

  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalDayGain = 0;

  const rows = Object.values(portfolio || {}).map((item) => {
    if (!item || !item.ticker) return "";
    const safeTicker = item.ticker.replace(".", "_");
    const liveData = state.livePrices[safeTicker] || {};
    const metaData = state.stocks[safeTicker] || {};
    const currentPrice = liveData.price || item.buyPrice;
    const sector = metaData.sector || liveData.sector || "Other";
    const displayName = metaData.name || liveData.name || item.ticker;
    const changePct = liveData.change_pct || 0;
    
    const invested = Number(item.qty || 0) * Number(item.buyPrice || 0);
    const currentValue = Number(item.qty || 0) * currentPrice;
    const pnl = currentValue - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    
    const dayGain = currentValue - (currentValue / (1 + changePct / 100));

    totalInvested += invested;
    totalCurrentValue += currentValue;
    totalDayGain += dayGain;

    const pnlCls = pnl >= 0 ? "positive" : "negative";

    return `
      <tr>
        <td>
          <div style="font-weight: 900; color: #fff; font-size: 1rem;">${item.ticker}</div>
          <div class="text-muted" style="font-size: 0.7rem;">${displayName}</div>
        </td>
        <td class="text-secondary" style="font-weight: 700;">${item.qty}</td>
        <td class="text-secondary">${formatCurrency(item.buyPrice)}</td>
        <td class="text-secondary">${formatCurrency(currentPrice)}</td>
        <td style="font-weight: 900; color: #fff;">${formatCurrency(currentValue)}</td>
        <td>
          <div class="${pnlCls}" style="font-weight: 900; font-size: 1rem;">${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}</div>
          <div class="${pnlCls}" style="font-size: 0.75rem; font-weight: 700;">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</div>
        </td>
        <td>
          <button class="why-holding-btn" onclick="alert('AI Insights for ${item.ticker}: Currently showing strong momentum with ${changePct.toFixed(2)}% daily move and healthy fundamental indicators.')">AI Analysis</button>
        </td>
        <td>
          <div style="display: flex; gap: 10px;">
            <button class="btn-table-buy" onclick="window.openTxModal('buy', '${item.ticker}')">Buy</button>
            <button class="btn-table-sell" onclick="window.openTxModal('sell', '${item.ticker}')">Sell</button>
          </div>
        </td>
      </tr>
    `;
  });

  portTbody.innerHTML = rows.join("") || '<tr><td colspan="8" class="muted" style="text-align:center; padding: 40px;">No active positions. Execute a trade to begin.</td></tr>';
  
  if (pmInvested) pmInvested.textContent = formatCurrency(totalInvested);
  if (pmCurrent) pmCurrent.textContent = formatCurrency(totalCurrentValue);
  
  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  
  const pnlLabel = document.getElementById("pm-pnl-label");
  if (pnlLabel) {
    pnlLabel.textContent = `${totalPnL >= 0 ? '+' : ''}${formatCurrency(totalPnL)} (${totalPnLPct.toFixed(2)}%)`;
    pnlLabel.className = `stat-value ${totalPnL >= 0 ? "positive" : "negative"}`;
  }

  if (pmDayGain) {
    pmDayGain.textContent = `${totalDayGain >= 0 ? '+' : ''}${formatCurrency(totalDayGain)}`;
    pmDayGain.className = `stat-value ${totalDayGain >= 0 ? "positive" : "negative"}`;
  }

  if (window.Chart) {
    renderAllocationChart(portfolio);
    renderPerformanceChart(totalCurrentValue);
  }
  renderAdvancedAIInsights(portfolio);
}

function renderAvailableBalance() {
  const availBalanceEl = document.getElementById("avail-balance");
  if (availBalanceEl) {
    availBalanceEl.textContent = formatCurrency(state.profile.availableBalance || 0);
  }
}



function renderTransactions() {
  const container = document.getElementById("transactions-container-v2");
  if (!container) return;
  const txs = Object.values(state.transactions || {})
    .filter(t => t && t.ticker) // Added safety filter
    .sort((a, b) => b.timestamp - a.timestamp);
  
  if (txs.length === 0) {
    container.innerHTML = '<p class="muted" style="text-align: center; padding: 20px;">No trades executed yet.</p>';
    return;
  }

  container.innerHTML = txs.slice(0, 4).map(tx => {
    const isBuy = tx.type === "buy";
    const date = new Date(tx.timestamp).toLocaleString("en-IN", { month: "short", day: "numeric" });
    return `
      <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="tx-icon ${isBuy ? 'tx-buy' : 'tx-sell'}" style="width: 32px; height: 32px; font-size: 0.7rem;">${isBuy ? 'B' : 'S'}</div>
          <div>
            <div style="font-weight: 800; font-size: 0.9rem;">${tx.ticker.replace("_", ".")}</div>
            <div class="muted" style="font-size: 0.7rem;">${date}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; color: ${isBuy ? 'var(--text)' : 'var(--accent)'};">${formatCurrency(tx.value)}</div>
          <div class="muted" style="font-size: 0.7rem;">${tx.qty} shares</div>
        </div>
      </div>
    `;
  }).join("");
}

// Chart Instances
let portChartInst = null;
let allocChartInst = null;

function renderPerformanceChart(currentValue) {
  const canvas = document.getElementById('portfolioChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 250);
  gradient.addColorStop(0, 'rgba(0, 255, 163, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 255, 163, 0)');

  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dataPoints = [currentValue * 0.8, currentValue * 0.85, currentValue * 0.82, currentValue * 0.9, currentValue * 0.95, currentValue * 0.92, currentValue * 1.0, currentValue * 0.98, currentValue * 1.05, currentValue * 1.1, currentValue * 1.08, currentValue];
  const niftyPoints = dataPoints.map(p => p * (0.9 + Math.random() * 0.2));

  if (portChartInst) {
    portChartInst.data.datasets[0].data = dataPoints;
    portChartInst.data.datasets[1].data = niftyPoints;
    portChartInst.update();
    return;
  }

  portChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'My Portfolio',
          data: dataPoints,
          borderColor: '#00ffa3',
          backgroundColor: gradient,
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6
        },
        {
          label: 'Nifty 50',
          data: niftyPoints,
          borderColor: 'rgba(255,255,255,0.2)',
          borderDash: [5, 5],
          borderWidth: 1,
          tension: 0.4,
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: true, labels: { color: '#94a3b8', font: { size: 10 } }, position: 'top', align: 'end' },
        tooltip: { backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1 }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } }
      }
    }
  });
}

function renderAllocationChart(portfolio) {
  const ctx = document.getElementById('allocationChart');
  if (!ctx) return;

  const sectorMap = {};
  Object.values(portfolio).forEach(item => {
    if (!item || !item.ticker) return;
    const safeTicker = item.ticker.replace(".", "_");
    const live = state.livePrices[safeTicker] || {};
    const meta = state.stocks[safeTicker] || {};
    const sector = meta.sector || live.sector || "Other";
    const value = item.qty * (live.price || item.buyPrice);
    if (value > 0) {
      sectorMap[sector] = (sectorMap[sector] || 0) + value;
    }
  });

  const labels = Object.keys(sectorMap);
  const data = Object.values(sectorMap);

  if (data.length === 0) {
    labels.push("Cash");
    data.push(100);
  }

  if (allocChartInst) {
    allocChartInst.data.labels = labels;
    allocChartInst.data.datasets[0].data = data;
    allocChartInst.update();
    return;
  }

  allocChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa', '#94a3b8'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '20%',
      plugins: {
        legend: { position: 'right', labels: { color: '#a1a1aa', boxWidth: 12, padding: 15 } }
      }
    }
  });
}

function renderAdvancedAIInsights(portfolio) {
  const container = document.getElementById("ai-insights-v2");
  const needle = document.getElementById("risk-needle-v2");
  const scoreLabel = document.getElementById("risk-score-v2");
  const divScore = document.getElementById("div-score-v2");
  const sectorWarnings = document.getElementById("sector-warnings");
  if (!container) return;

  const items = Object.values(portfolio);
  if (items.length === 0) {
    container.innerHTML = '<p class="muted" style="text-align: center; margin-top: 40px;">Buy stocks to generate AI insights.</p>';
    if (needle) needle.style.transform = `rotate(0deg)`;
    return;
  }

  const sectorMap = {};
  let totalValue = 0;
  items.forEach(item => {
    if (!item || !item.ticker) return;
    const live = state.livePrices[item.ticker.replace(".", "_")] || {};
    const sector = live.sector || "Other";
    const val = item.qty * (live.price || item.buyPrice);
    sectorMap[sector] = (sectorMap[sector] || 0) + val;
    totalValue += val;
  });

  const sectors = Object.keys(sectorMap);
  const healthScore = Math.min(10, Math.max(1, Math.floor(sectors.length * 1.5 + (items.length > 5 ? 2 : 0))));
  
  // New: Average P/E of portfolio
  let totalPE = 0, peCount = 0;
  items.forEach(it => {
    if (!it || !it.ticker) return;
    const live = state.livePrices[it.ticker.replace(".", "_")];
    if(live?.pe) { totalPE += live.pe; peCount++; }
  });
  const avgPE = peCount > 0 ? (totalPE / peCount).toFixed(1) : "N/A";

  if (divScore) divScore.textContent = `${healthScore}/10`;
  
  // Update UI to show Valuation Insight
  const valuationNote = document.getElementById("valuation-summary");
  if(valuationNote) valuationNote.textContent = `Avg P/E: ${avgPE} | Stocks: ${items.length}`;


  // Update Mini Diversification Score & Suggestion in Hero
  const miniDiv = document.getElementById("pm-div-score");
  const divSug = document.getElementById("div-sug");
  if (miniDiv) {
    miniDiv.textContent = `${healthScore}/10`;
    miniDiv.style.color = healthScore > 7 ? 'var(--accent)' : (healthScore > 4 ? 'var(--warning)' : 'var(--danger)');
  }
  if (divSug) {
    if (healthScore > 7) divSug.textContent = "Optimal Mix";
    else if (healthScore > 4) divSug.textContent = "Add 1-2 Sectors";
    else divSug.textContent = "Over-Concentrated";
  }

  // Other Suggestions
  const alphaSug = document.getElementById("alpha-sug");
  const gainSug = document.getElementById("gain-sug");
  const volSug = document.getElementById("vol-sug");

  if (alphaSug) {
    const alpha = parseFloat(pmDayGainAlpha?.textContent || "0");
    alphaSug.textContent = alpha > 0 ? "Beating Market" : "Trailing Nifty";
  }
  if (gainSug) {
    const dayGain = parseFloat((pmDayGain?.textContent || "0").replace(/[^0-9.-]/g, ""));
    gainSug.textContent = dayGain > 0 ? "Daily Profit" : "Daily Drawdown";
  }
  if (volSug) {
    volSug.textContent = items.length > 5 ? "Diversified Risk" : "Single Stock Risk";
  }

  let riskAngle = 45;
  let riskText = "Moderate";
  let alerts = [];

  // Overexposure Check
  let maxSector = "";
  let maxPct = 0;
  for (const [sec, val] of Object.entries(sectorMap)) {
    const pct = val / totalValue;
    if (pct > maxPct) { maxPct = pct; maxSector = sec; }
  }

  if (maxPct > 0.4) {
    alerts.push({
      type: 'warning',
      title: `Overexposed: ${maxSector}`,
      desc: `Your capital is ${(maxPct*100).toFixed(0)}% concentrated in ${maxSector}. Reduce risk by rebalancing.`
    });
    riskAngle = 135;
    riskText = "High Risk";
  } else {
    alerts.push({
      type: 'success',
      title: 'Balanced Allocation',
      desc: 'No single sector dominates your portfolio. Good job!'
    });
    riskAngle = -45;
    riskText = "Safe";
  }

  if (items.length > 0) {
    alerts.push({
      type: 'info',
      title: 'Rebalancing Advice',
      desc: 'Market conditions suggest shifting 5% capital to defensive sectors like FMCG.'
    });
  }

  container.innerHTML = alerts.map(a => `
    <div class="insight-alert ${a.type}">
      <div class="insight-content">
        <h4>${a.title}</h4>
        <p>${a.desc}</p>
      </div>
    </div>
  `).join("");

  if (needle) needle.style.transform = `rotate(${riskAngle}deg)`;
  if (scoreLabel) {
    scoreLabel.textContent = riskText;
    scoreLabel.style.color = riskText === "Safe" ? "var(--accent)" : (riskText === "High Risk" ? "var(--danger)" : "var(--warning)");
  }
}


function setUserUI(user, profilePrefs) {
  const drawerProfileInfo = document.getElementById("drawer-profile-info");
  const drawerProfilePic = document.getElementById("drawer-profile-pic");
  const drawerProfileName = document.getElementById("drawer-profile-name");
  const drawerProfileEmail = document.getElementById("drawer-profile-email");
  const drawerLogoutLink = document.getElementById("mobile-logout-link");
  const drawerLoginLink = document.getElementById("mobile-login-link");

  if (!user) {
    if (profileName) profileName.textContent = "Guest";
    if (profileEmail) profileEmail.textContent = "Not logged in";
    if (headerProfileName) headerProfileName.textContent = "Guest";
    if (headerProfileEmail) headerProfileEmail.textContent = "Not logged in";
    profilePic?.removeAttribute("src");
    headerProfilePic?.removeAttribute("src");
    if (displayNameInput) displayNameInput.value = "";
    if (themeAccentInput) themeAccentInput.value = "emerald";
    applyAccent("emerald");

    if (drawerProfileInfo) drawerProfileInfo.style.display = "none";
    if (drawerLogoutLink) drawerLogoutLink.style.display = "none";
    if (drawerLoginLink) drawerLoginLink.style.display = "flex";
    return;
  }

  const preferredName = profilePrefs?.customName || user.displayName || "User";
  const accent = profilePrefs?.themeAccent || "emerald";
  const photo = user.photoURL || "";

  if (profileName) profileName.textContent = preferredName;
  if (profileEmail) profileEmail.textContent = user.email || "";
  if (headerProfileName) headerProfileName.textContent = preferredName;
  if (headerProfileEmail) headerProfileEmail.textContent = user.email || "";
  if (displayNameInput) displayNameInput.value = profilePrefs?.customName || "";
  if (themeAccentInput) themeAccentInput.value = accent;
  if (profilePic) profilePic.src = photo;
  if (headerProfilePic) headerProfilePic.src = photo;
  applyAccent(accent);

  if (drawerProfileInfo) drawerProfileInfo.style.display = "flex";
  if (drawerProfilePic) drawerProfilePic.src = photo;
  if (drawerProfileName) drawerProfileName.textContent = preferredName;
  if (drawerProfileEmail) drawerProfileEmail.textContent = user.email || "";
  if (drawerLogoutLink) drawerLogoutLink.style.display = "flex";
  if (drawerLoginLink) drawerLoginLink.style.display = "none";
}

function applyAccent(accent) {
  document.body.dataset.accent = accent;
}

window.setViewMode = function(mode) {
  document.body.classList.remove("force-desktop", "force-mobile");
  document.querySelectorAll("[id^='mode-']").forEach(btn => btn.classList.remove("active"));
  
  if (mode === "desktop") {
    document.body.classList.add("force-desktop");
    document.getElementById("mode-desktop")?.classList.add("active");
  } else if (mode === "mobile") {
    document.body.classList.add("force-mobile");
    document.getElementById("mode-mobile")?.classList.add("active");
  } else {
    document.getElementById("mode-auto")?.classList.add("active");
  }
  
  localStorage.setItem("stocksense_view_mode", mode);
  window.dispatchEvent(new Event('resize'));
};

function renderDashboard() {
  const merged = Object.keys(state.stocks).map((ticker) => ({
    ticker,
    ...state.stocks[ticker],
    ...(state.livePrices[ticker.replace(".", "_")] || {})
  }));

  if (trackedCount) trackedCount.textContent = String(merged.length);
  
  const gainersCount = merged.filter(s => (s.change_pct || 0) > 0).length;
  const losersCount = merged.filter(s => (s.change_pct || 0) < 0).length;
  const totalChange = merged.reduce((acc, s) => acc + (s.change_pct || 0), 0);
  const avgMove = merged.length > 0 ? totalChange / merged.length : 0;

  if (statGainers) statGainers.textContent = String(gainersCount);
  if (statLosers) statLosers.textContent = String(losersCount);
  if (statAvg) statAvg.textContent = `${avgMove.toFixed(2)}%`;

  // Render Sidebar Widgets
  renderSidebar(merged);

  // Render Live
  let liveMerged = [...merged];
  const query = liveSearch?.value.toLowerCase().trim() || "";
  if (query) {
    if (query === ">0%") {
      liveMerged = liveMerged.filter(s => (s.change_pct || 0) > 0);
    } else if (query === "<0%") {
      liveMerged = liveMerged.filter(s => (s.change_pct || 0) < 0);
    } else if (query === "<-2%") {
      liveMerged = liveMerged.filter(s => (s.change_pct || 0) < -2);
    } else if (query === "-2to0%") {
      liveMerged = liveMerged.filter(s => (s.change_pct || 0) >= -2 && (s.change_pct || 0) < 0);
    } else if (query === "0to2%") {
      liveMerged = liveMerged.filter(s => (s.change_pct || 0) >= 0 && (s.change_pct || 0) <= 2);
    } else if (query === ">2%") {
      liveMerged = liveMerged.filter(s => (s.change_pct || 0) > 2);
    } else {
      liveMerged = liveMerged.filter(s => s.ticker.toLowerCase().includes(query));
    }
  }
  if (liveCount) liveCount.textContent = `${liveMerged.length} stocks`;
  renderLive(liveMerged);

  renderMarketChart(merged);

  if (state.user && state.portfolio) {
    renderPortfolio(state.portfolio);
  }
}

function renderSidebar(stocks) {
  const sortedByChange = [...stocks].sort((a, b) => (Number(b.change_pct) || 0) - (Number(a.change_pct) || 0));
  
  if (topGainers) {
    const gainers = sortedByChange.slice(0, 3).filter(s => (Number(s.change_pct) || 0) > 0);
    topGainers.innerHTML = `<h3 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="window.filterLive('gainers')">Top Gainers <span style="font-size: 0.8rem; font-weight: normal; color: var(--accent);">View All →</span></h3>` + 
      gainers.map(s => `<div class="mover-row" style="cursor: pointer;" onclick="window.jumpToStock('${s.ticker}')"><span>${s.ticker}</span><span class="positive">+${Number(s.change_pct).toFixed(2)}%</span></div>`).join("") || emptyState("No gainers");
  }
  
  if (topLosers) {
    const losers = sortedByChange.slice(-3).reverse().filter(s => (Number(s.change_pct) || 0) < 0);
    topLosers.innerHTML = `<h3 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="window.filterLive('losers')">Top Losers <span style="font-size: 0.8rem; font-weight: normal; color: var(--danger);">View All →</span></h3>` + 
      losers.map(s => `<div class="mover-row" style="cursor: pointer;" onclick="window.jumpToStock('${s.ticker}')"><span>${s.ticker}</span><span class="negative">${Number(s.change_pct).toFixed(2)}%</span></div>`).join("") || emptyState("No losers");
  }
  
  if (sectorGrid) {
    const sectors = {};
    stocks.forEach(s => {
      const sec = s.sector || "Other";
      if (!sectors[sec]) sectors[sec] = { count: 0, change: 0 };
      sectors[sec].count++;
      sectors[sec].change += (Number(s.change_pct) || 0);
    });
    const html = Object.entries(sectors).map(([sec, data]) => {
      const avg = data.change / data.count;
      const cls = avg >= 0 ? "positive" : "negative";
      return `<div class="sector-cell"><span>${sec}</span><span class="${cls}">${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%</span></div>`;
    }).join("");
    sectorGrid.innerHTML = html || emptyState("No sectors");
  }
}

function renderLive(stocks) {
  if (!liveTablesContainer) return;

  if (!stocks.length) {
    liveTablesContainer.innerHTML = emptyState("No stocks match the criteria.");
    return;
  }

  // Save open states
  const openDetails = new Set();
  document.querySelectorAll('.scrip-accordion[open]').forEach(el => {
    if (el.id) openDetails.add(el.id);
  });
  const focusedInput = document.activeElement;
  const focusedInputId = focusedInput && focusedInput.tagName === "INPUT" ? focusedInput.id : null;
  const focusedInputValue = focusedInputId ? focusedInput.value : null;

  // Group stocks by sector
  const bySector = {};
  stocks.forEach(stock => {
    const sec = stock.sector || "Uncategorized";
    if (!bySector[sec]) bySector[sec] = [];
    bySector[sec].push(stock);
  });

  // Sort sectors alphabetically
  const sortedSectors = Object.keys(bySector).sort();

  liveTablesContainer.innerHTML = sortedSectors.map(sector => {
    const sectorStocks = bySector[sector];
    
    // Sort stocks within sector by change_pct
    sectorStocks.sort((a, b) => (b.change_pct || 0) - (a.change_pct || 0));

    const rows = sectorStocks.map(stock => {
      const change = Number(stock.change_pct || 0);
      const cls = change >= 0 ? "positive" : "negative";
      const icon = change >= 0 ? "▲" : "▼";
      const aiScore = stock.ml ? formatScore(stock.ml) : "N/A";
      const signals = Array.isArray(stock.signals) ? stock.signals.join(", ") : "N/A";
      const safeTicker = (stock.ticker || "").replace(/[^a-zA-Z0-9]/g, '_');
      
      return `
        <details class="scrip-accordion" id="details-${safeTicker}">
          <summary class="scrip-summary">
            <div class="scrip-grid">
              <span class="td-ticker" style="color: var(--accent); font-weight: bold;">${stock.ticker}</span>
              <strong class="price-value ${cls}">${formatCurrency(stock.price)}</strong>
              <span class="${cls}">${icon} ${change.toFixed(2)}%</span>
              <span class="muted">${formatVolume(stock.volume)}</span>
            </div>
          </summary>
          <div class="scrip-details">
            <div class="scrip-detail-section">
              <h5 class="eyebrow" style="margin: 0 0 8px 0; color: var(--accent);">Market Data</h5>
              <div class="scrip-stat"><span class="muted">Open:</span> <strong>${stock.open ? formatCurrency(stock.open) : "N/A"}</strong></div>
              <div class="scrip-stat"><span class="muted">High:</span> <strong>${stock.high ? formatCurrency(stock.high) : "N/A"}</strong></div>
              <div class="scrip-stat"><span class="muted">Low:</span> <strong>${stock.low ? formatCurrency(stock.low) : "N/A"}</strong></div>
            </div>
            <div class="scrip-detail-section">
              <h5 class="eyebrow" style="margin: 0 0 8px 0; color: var(--accent);">Technicals</h5>
              <div class="scrip-stat"><span class="muted">Volatility (20d):</span> <strong>${stock.volatility ? stock.volatility.toFixed(2) + '%' : "N/A"}</strong></div>
              <div class="scrip-stat"><span class="muted">52W High:</span> <strong>${stock.w52_high ? formatCurrency(stock.w52_high) : "N/A"}</strong></div>
              <div class="scrip-stat"><span class="muted">52W Low:</span> <strong>${stock.w52_low ? formatCurrency(stock.w52_low) : "N/A"}</strong></div>
            </div>
            <div class="scrip-detail-section">
              <h5 class="eyebrow" style="margin: 0 0 8px 0; color: var(--accent);">AI Insights</h5>
          <div class="scrip-details" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-top: 16px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 12px;">
            <div class="detail-item">
              <span class="muted" style="font-size: 0.7rem; display: block; margin-bottom: 4px;">52W High / Low</span>
              <div style="font-weight: 700; font-size: 0.9rem;">
                <span class="positive">${formatCurrency(stock.h52 || 0)}</span> / <span class="negative">${formatCurrency(stock.l52 || 0)}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="muted" style="font-size: 0.7rem; display: block; margin-bottom: 4px;">Support / Resistance</span>
              <div style="font-weight: 700; font-size: 0.9rem;">
                <span class="positive">${formatCurrency(stock.sup || 0)}</span> / <span class="negative">${formatCurrency(stock.res || 0)}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="muted" style="font-size: 0.7rem; display: block; margin-bottom: 4px;">Today's H / L</span>
              <div style="font-weight: 700; font-size: 0.9rem;">
                ${formatCurrency(stock.high || 0)} / ${formatCurrency(stock.low || 0)}
              </div>
            </div>
            <div class="detail-item">
              <span class="muted" style="font-size: 0.7rem; display: block; margin-bottom: 4px;">AI Confidence</span>
              <div style="font-weight: 700; font-size: 0.9rem; color: var(--accent);">${aiScore}</div>
            </div>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 10px;">
            <button class="btn btn-primary" onclick="window.openTxModal('buy', '${stock.ticker}')" style="flex: 1; border-radius: 10px; height: 40px; font-weight: 700;">Buy ${stock.ticker}</button>
            <button class="btn btn-ghost" onclick="window.toggleWatchlist('${stock.ticker}')" style="border-radius: 10px; height: 40px; width: 48px; display: grid; place-items: center;">
              ${state.watchlist[safeTicker] ? '★' : '☆'}
            </button>
          </div>
        </details>
      `;
    }).join("");

    return `
      <details class="sector-accordion" onmouseenter="this.setAttribute('open', '')" onmouseleave="this.removeAttribute('open')">
        <summary class="sector-summary">
          <h3 class="accordion-title">
            <span class="accordion-icon">▶</span> ${sector}
          </h3>
          <span class="muted" style="font-size: 0.9em;">${sectorStocks.length} symbols</span>
        </summary>
        <div class="scrip-list-container">
          <div class="scrip-grid scrip-header">
            <span>Ticker</span><span>Price</span><span>Change</span><span>Volume</span>
          </div>
          <div class="scrip-list">
            ${rows}
          </div>
        </div>
      </details>
    `;
  }).join("");

  // Restore open states and focus
  document.querySelectorAll('.scrip-accordion').forEach(el => {
    if (el.id && openDetails.has(el.id)) el.setAttribute('open', '');
  });
  if (focusedInputId) {
    const inputToFocus = document.getElementById(focusedInputId);
    if (inputToFocus) {
      inputToFocus.focus();
      if (focusedInputValue !== null) {
        inputToFocus.value = focusedInputValue;
      }
    }
  }
}

function getNewsSentiment(n) {
  if (n.sentiment && (n.sentiment === 'Bullish' || n.sentiment === 'Bearish')) return n.sentiment;
  
  const title = n.title || "";
  const summary = n.summary || "";
  const text = (title + " " + summary).toLowerCase();
  
  const bullishWords = [
    'surge', 'jump', 'gain', 'profit', 'beat', 'growth', 'bullish', 
    'positive', 'rally', 'upgrade', 'climb', 'soar', 'strong', 'higher',
    'record high', 'expand', 'exceed', 'outperform', 'recovery', 'revival',
    'dividend', 'acquisition', 'partner', 'success', 'grew', 'doubled', 'tripled',
    'upbeat', 'high', 'optimistic'
  ];
  
  const bearishWords = [
    'drop', 'fall', 'loss', 'crash', 'miss', 'slump', 'bearish',
    'negative', 'downgrade', 'decline', 'plunge', 'weak', 'lower', 'hit',
    'slashed', 'shrink', 'underperform', 'deficit', 'debt', 'fine',
    'penalty', 'lawsuit', 'investigation', 'scam', 'fraud', 'crisis',
    'fell', 'slums', 'recession', 'sluggish', 'sink'
  ];
  
  let bullScore = 0;
  let bearScore = 0;
  
  bullishWords.forEach(w => {
    if (text.includes(w)) bullScore++;
  });
  
  bearishWords.forEach(w => {
    if (text.includes(w)) bearScore++;
  });
  
  if (bullScore > bearScore) return 'Bullish';
  if (bearScore > bullScore) return 'Bearish';
  return 'Neutral';
}

function renderNews() {
  if (!newsGrid) return;
  
  const query = newsInput?.value.toLowerCase().trim() || "";
  let filtered = state.news || [];

  // Populate Breaking News Ticker
  const tickerContent = document.getElementById("ticker-news-content");
  if (tickerContent && filtered.length > 0) {
    tickerContent.innerHTML = filtered.slice(0, 10).map(n => `
      <div class="ticker-news-item" onclick="window.open('${n.link}', '_blank')">
        <span class="dot"></span>
        ${n.title}
      </div>
    `).join("");
  }

  // Filter by Category
  if (state.newsCategory === 'Bullish') {
    filtered = filtered.filter(item => getNewsSentiment(item) === 'Bullish');
  } else if (state.newsCategory === 'Bearish') {
    filtered = filtered.filter(item => getNewsSentiment(item) === 'Bearish');
  } else if (state.newsCategory !== 'all') {
    filtered = filtered.filter(item => item.category === state.newsCategory);
  }

  // Filter by Search Query
  if (query) {
    filtered = filtered.filter(item => 
      (item.title || "").toLowerCase().includes(query) || 
      (item.source || "").toLowerCase().includes(query)
    );
  }

  if (!filtered.length) {
    newsGrid.innerHTML = `<div class="premium-card" style="grid-column: 1/-1; text-align: center; padding: 60px;">
      <p class="muted">${state.language === 'hi' ? 'कोई समाचार नहीं मिला' : 'No matching intelligence found.'}</p>
    </div>`;
    return;
  }

  const newsHtml = filtered.slice(0, state.newsLimit).map(n => {
    const ts = n.updated_at || Date.now();
    const timeAgo = Math.floor((Date.now() - ts) / 60000);
    const timeDisplay = timeAgo < 1 ? (state.language === 'hi' ? 'अभी' : 'Just now') : 
                        (timeAgo < 60 ? `${timeAgo}${state.language === 'hi' ? ' मिनट पहले' : 'm ago'}` : 
                        `${Math.floor(timeAgo/60)}${state.language === 'hi' ? ' घंटे पहले' : 'h ago'}`);
    
    // Simple sentiment detection for visual flair
    const sentiment = getNewsSentiment(n);
    const isPositive = sentiment === 'Bullish';
    const isNegative = sentiment === 'Bearish';
    const sentimentCls = isPositive ? 'positive' : (isNegative ? 'negative' : '');
    const sentimentLabel = isPositive ? (state.language === 'hi' ? 'सकारात्मक' : 'BULLISH') : 
                          (isNegative ? (state.language === 'hi' ? 'नकारात्मक' : 'BEARISH') : 
                          (state.language === 'hi' ? 'तटस्थ' : 'NEUTRAL'));

    return `
      <article class="news-card-premium" onclick="window.open('${n.link}', '_blank')">
        <div class="news-content">
          <div class="news-meta">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="news-source">${n.source || 'Finance'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="color: var(--muted);"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
            </div>
            <span class="news-time"><span class="live-indicator"></span>${timeDisplay}</span>
          </div>
          <h3 class="news-title ${sentimentCls}">${n.title}</h3>
          <p class="news-excerpt">${n.summary || (state.language === 'hi' ? 'इस बाज़ार घटना पर पूरी इंटेलिजेंस रिपोर्ट पढ़ने के लिए क्लिक करें।' : 'Click to read full intelligence report on this market event.')}</p>
          <div class="news-footer">
            <div style="display: flex; gap: 8px;">
              <span class="news-tag" style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">${n.category === 'Global Market' ? (state.language === 'hi' ? 'वैश्विक' : 'GLOBAL') : (state.language === 'hi' ? 'भारतीय' : 'INDIAN')}</span>
              <span class="news-tag ${sentimentCls}" style="opacity: 0.8;">${sentimentLabel}</span>
            </div>
            <div class="news-action-btn">
              ${state.language === 'hi' ? 'स्रोत पर जाएँ' : 'Go to Source'} 
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left: 4px;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  let loadMoreHtml = "";
  if (filtered.length > state.newsLimit) {
    loadMoreHtml = `<button id="btn-load-more-news" class="btn btn-ghost" style="width: 100%; margin-top: 12px;">${state.language === 'hi' ? 'और समाचार लोड करें' : 'Load More News'}</button>`;
  }

  newsGrid.innerHTML = newsHtml + loadMoreHtml;

  const loadMoreBtn = document.getElementById("btn-load-more-news");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      state.newsLimit += 10;
      renderNews();
    });
  }
}

function renderAIPicks() {
  if (!aiGrid) return;
  const picks = Object.values(state.aiPicks || {});
  
  if (!picks.length) {
    aiGrid.innerHTML = emptyState("AI Model is analyzing the market. Results appearing soon.");
    return;
  }

  const sortedPicks = picks.sort((a, b) => b.score - a.score);
  const visiblePicks = sortedPicks.slice(0, state.aiPicksLimit);

  aiGrid.innerHTML = visiblePicks
    .map((stock) => {
      const labelCls = (stock.label || "").toLowerCase().replace(" ", "-");
      const score = stock.score || 0;
      const qScore = stock.quality_score || 0;

      let labelColor = "var(--accent)";
      if (labelCls.includes("avoid") || labelCls.includes("underperform")) labelColor = "var(--danger)";
      else if (labelCls.includes("hold") || labelCls.includes("watch")) labelColor = "var(--warning)";

      return `
        <article class="price-card hover-glow results-tooltip-container" style="border-left: 4px solid ${labelColor}; cursor: pointer; transition: all 0.2s ease; padding: 14px; min-height: auto; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 8px;" onclick="window.showStockDetails('${stock.ticker}')">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="ai-label ${labelCls}" style="font-size: 0.6rem; padding: 2px 6px; border-radius: 4px;">${stock.label || "Neutral"}</span>
            <span style="font-size: 0.65rem; color: var(--muted); font-weight: 600;">Confidence: ${stock.confidence}%</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <h4 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #fff;">${stock.ticker.split(".")[0]}</h4>
            <span style="font-size: 0.65rem; color: var(--muted); font-weight: 600;">NSE Listing</span>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 4px 0;">
            <div style="background: rgba(255,255,255,0.02); padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
              <div style="font-size: 0.6rem; color: var(--muted); text-transform: uppercase;">Trend</div>
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent); margin-top: 2px;">${score}/100</div>
            </div>
            <div style="background: rgba(255,255,255,0.02); padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
              <div style="font-size: 0.6rem; color: var(--muted); text-transform: uppercase;">Quality</div>
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--info); margin-top: 2px;">${qScore}/100</div>
            </div>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 8px; margin-top: 4px;">
            <span style="font-size: 0.65rem; color: var(--muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 140px;">${stock.reasons?.[0] || 'Technical Reversal'}</span>
            <span style="color: var(--accent); font-weight: 700; font-size: 0.65rem; display: flex; align-items: center; gap: 2px; flex-shrink: 0;">DETAILS &rarr;</span>
          </div>
          <div class="tooltip-content">${getExpectedResultsHTML(stock.ticker)}</div>
        </article>
      `;
    })
    .join("");

  const suggestMoreBtn = document.getElementById("btn-suggest-more");
  if (suggestMoreBtn) {
    if (state.aiPicksLimit >= sortedPicks.length) {
      suggestMoreBtn.style.display = "none";
    } else {
      suggestMoreBtn.style.display = "inline-flex";
    }
  }
}

// Subtab event switching and rendering functions for Intrinsic Valuation model
setupValuationTabs();

function setupValuationTabs() {
  const techBtn = document.getElementById("ai-tab-tech-btn");
  const valBtn = document.getElementById("ai-tab-val-btn");
  const techContainer = document.getElementById("ai-tech-container");
  const valContainer = document.getElementById("ai-val-container");

  if (techBtn && valBtn && techContainer && valContainer) {
    techBtn.addEventListener("click", () => {
      techBtn.classList.add("active");
      valBtn.classList.remove("active");
      techBtn.style.background = "rgba(255, 255, 255, 0.08)";
      techBtn.style.color = "#fff";
      valBtn.style.background = "transparent";
      valBtn.style.color = "var(--muted)";
      techContainer.classList.remove("hidden");
      valContainer.classList.add("hidden");
    });

    valBtn.addEventListener("click", () => {
      techBtn.classList.remove("active");
      valBtn.classList.add("active");
      techBtn.style.background = "transparent";
      techBtn.style.color = "var(--muted)";
      valBtn.style.background = "rgba(255, 255, 255, 0.08)";
      valBtn.style.color = "#fff";
      techContainer.classList.add("hidden");
      valContainer.classList.remove("hidden");
      renderValuationPicks();
    });
  } else {
    setTimeout(setupValuationTabs, 100);
  }
}

window.filterValuation = function(category) {
  state.valuationFilter = category;
  document.querySelectorAll(".val-filters .ctrl-badge").forEach(el => {
    el.classList.remove("active");
  });
  const filterIdMap = {
    "all": "val-filter-all",
    "Undervalued": "val-filter-undervalued",
    "Fair Value": "val-filter-fair",
    "Overvalued": "val-filter-overvalued"
  };
  const activeEl = document.getElementById(filterIdMap[category]);
  if (activeEl) activeEl.classList.add("active");
  renderValuationPicks();
};

function renderValuationPicks() {
  const grid = document.getElementById("aiValuationGrid");
  if (!grid) return;

  const picks = Object.values(state.valuationPicks || {});
  if (!picks.length) {
    grid.innerHTML = emptyState("AI Valuation Model is analyzing the market. Results appearing soon.");
    return;
  }

  // Filter
  let filtered = [...picks];
  if (state.valuationFilter !== "all") {
    filtered = filtered.filter(p => p.consensus && p.consensus.status === state.valuationFilter);
  }

  if (!filtered.length) {
    grid.innerHTML = emptyState("No stocks match this valuation criteria.");
    return;
  }

  // Sort: Undervalued first, sorted by Margin of Safety (highest to lowest), then Fair Value, then Overvalued.
  filtered.sort((a, b) => {
    const statusOrder = { "Undervalued": 1, "Fair Value": 2, "Overvalued": 3 };
    const orderA = statusOrder[a.consensus?.status || "Fair Value"] || 2;
    const orderB = statusOrder[b.consensus?.status || "Fair Value"] || 2;
    if (orderA !== orderB) return orderA - orderB;
    return (b.consensus?.margin_of_safety || 0) - (a.consensus?.margin_of_safety || 0);
  });

  grid.innerHTML = filtered.map(stock => {
    const status = stock.consensus?.status || "Fair Value";
    const mos = stock.consensus?.margin_of_safety || 0;
    
    let badgeCls = "watchlist";
    let badgeColor = "var(--warning)";
    let safetyCls = "neutral";
    let safetyColor = "var(--muted)";
    
    if (status === "Undervalued") {
      badgeCls = "strong-buy";
      badgeColor = "var(--accent)";
      safetyCls = "positive";
      safetyColor = "var(--accent)";
    } else if (status === "Overvalued") {
      badgeCls = "weak";
      badgeColor = "var(--danger)";
      safetyCls = "negative";
      safetyColor = "var(--danger)";
    }

    const shortTicker = stock.ticker.split(".")[0];

    return `
      <article class="price-card hover-glow results-tooltip-container" style="border-left: 4px solid ${badgeColor}; transition: all 0.2s ease; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="ai-label ${badgeCls}" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px;">${status}</span>
          <span style="font-size: 0.65rem; color: var(--muted); font-weight: 600;">Margin of Safety: <span class="${safetyCls}" style="color: ${safetyColor}; font-weight: 800;">${mos >= 0 ? "+" : ""}${mos}%</span></span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <h4 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #fff;">${shortTicker}</h4>
          <span style="font-size: 0.65rem; color: var(--muted); font-weight: 600;">₹${stock.current_price.toLocaleString("en-IN")}</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 4px 0;">
          <div style="background: rgba(255,255,255,0.02); padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
            <div style="font-size: 0.55rem; color: var(--muted); text-transform: uppercase;">Consensus Value</div>
            <div style="font-size: 0.85rem; font-weight: 700; color: #fff; margin-top: 2px;">₹${(stock.consensus?.intrinsic_value || 0).toLocaleString("en-IN")}</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
            <div style="font-size: 0.55rem; color: var(--muted); text-transform: uppercase;">Growth Expect.</div>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--info); margin-top: 2px;">${stock.growth}%</div>
          </div>
        </div>
        
        <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; margin-top: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.65rem; margin-bottom: 3px;">
            <span class="muted">P/E Valuation (Fair PE: ${stock.pe_valuation?.fair_pe}):</span>
            <span style="font-weight: 700; color: ${stock.pe_valuation?.status === 'Undervalued' ? 'var(--accent)' : stock.pe_valuation?.status === 'Overvalued' ? 'var(--danger)' : '#fff'};">₹${stock.pe_valuation?.intrinsic_value}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.65rem; margin-bottom: 3px;">
            <span class="muted">Graham Formula (8.5 + 2g):</span>
            <span style="font-weight: 700; color: ${stock.graham_valuation?.status === 'Undervalued' ? 'var(--accent)' : stock.graham_valuation?.status === 'Overvalued' ? 'var(--danger)' : '#fff'};">₹${stock.graham_valuation?.intrinsic_value}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.65rem; margin-bottom: 3px;">
            <span class="muted">DCF Model (CAPM: ${stock.discount_rate}%):</span>
            <span style="font-weight: 700; color: ${stock.dcf_valuation?.status === 'Undervalued' ? 'var(--accent)' : stock.dcf_valuation?.status === 'Overvalued' ? 'var(--danger)' : '#fff'};">₹${stock.dcf_valuation?.intrinsic_value}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.65rem;">
            <span class="muted">PEG Ratio (PE/Growth):</span>
            <span style="font-weight: 700; color: ${stock.peg_valuation?.status === 'Cheap' ? 'var(--accent)' : stock.peg_valuation?.status === 'Expensive' ? 'var(--danger)' : '#fff'};">${stock.peg_valuation?.status === 'Cheap' ? 'Cheap' : stock.peg_valuation?.status === 'Expensive' ? 'Expensive' : 'Fair'} (${stock.peg_valuation?.peg_ratio})</span>
          </div>
        </div>

        <div style="margin-top: 8px; display: flex; gap: 8px;">
          <button class="btn btn-primary" onclick="window.openTxModal('buy', '${stock.ticker}')" style="flex: 1; border-radius: 8px; height: 32px; font-size: 0.72rem; font-weight: 700; padding: 0;">Buy</button>
          <button class="btn btn-ghost" onclick="window.jumpToStock('${stock.ticker}')" style="flex: 1; border-radius: 8px; height: 32px; font-size: 0.72rem; font-weight: 700; padding: 0; border: 1px solid var(--line);">Details &rarr;</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderAIMarketSuggestion(data) {
  const container = document.getElementById("ai-market-pulse-container");
  if (!container || !data) return;

  const colorMap = {
    green: "var(--accent)",
    red: "var(--danger)",
    yellow: "var(--warning)"
  };
  const bgColorMap = {
    green: "rgba(0, 255, 163, 0.1)",
    red: "rgba(255, 77, 77, 0.1)",
    yellow: "rgba(255, 184, 0, 0.1)"
  };

  const statusMap = {
    "Market is currently Bullish.": "BULLISH",
    "Market is currently Bearish.": "BEARISH",
    "Market is currently Neutral.": "NEUTRAL"
  };

  const text = statusMap[data.pulse] || data.pulse.replace("Market is currently ", "").replace(".", "").toUpperCase();
  const color = colorMap[data.color] || "var(--accent)";
  const bgColor = bgColorMap[data.color] || "rgba(0, 255, 163, 0.1)";

  container.innerHTML = `
    <div class="hover-glow" style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 6px 14px; border-radius: 99px; backdrop-filter: blur(10px); box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
      <span style="font-size: 0.65rem; color: var(--muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Market Pulse:</span>
      <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${color}; box-shadow: 0 0 10px ${color};"></span>
      <span style="font-size: 0.72rem; font-weight: 800; color: ${color}; letter-spacing: 0.5px;">${text}</span>
    </div>
  `;
}

function renderCuratedPicks() {
  const bestList = document.getElementById("bestPerformersList");
  const potentialList = document.getElementById("potentialStarsList");
  const divList = document.getElementById("dividendStarsList");

  const data = state.curatedPicks;
  if (!data) return;

  if (bestList && data.best_performers) {
    if (!data.best_performers.length) {
      bestList.innerHTML = `<div class="empty-state" style="padding: 16px;">No performers data.</div>`;
    } else {
      bestList.innerHTML = data.best_performers.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: all 0.2s;" class="hover-scale results-tooltip-container" onclick="window.showStockDetails('${item.ticker}')">
          <div style="min-width: 0; flex: 1; padding-right: 8px;">
            <div style="font-weight: 700; font-size: 0.9rem; color: #fff;">${item.ticker.split(".")[0]}</div>
            <div style="font-size: 0.7rem; color: var(--muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${item.name}</div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
            <span class="ctrl-badge" style="background: rgba(0, 255, 163, 0.1); color: var(--accent); font-size: 0.68rem; border-color: rgba(0, 255, 163, 0.2);">Rev: +${item.revenue_growth}%</span>
            <span class="ctrl-badge" style="background: rgba(96, 165, 250, 0.1); color: var(--info); font-size: 0.68rem; border-color: rgba(96, 165, 250, 0.2);">Margin: ${item.margin}%</span>
          </div>
          <div class="tooltip-content">${getExpectedResultsHTML(item.ticker)}</div>
        </div>
      `).join("");
    }
  }

  if (potentialList && data.potential_stars) {
    if (!data.potential_stars.length) {
      potentialList.innerHTML = `<div class="empty-state" style="padding: 16px;">No future potential data.</div>`;
    } else {
      potentialList.innerHTML = data.potential_stars.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: all 0.2s;" class="hover-scale results-tooltip-container" onclick="window.showStockDetails('${item.ticker}')">
          <div style="min-width: 0; flex: 1; padding-right: 8px;">
            <div style="font-weight: 700; font-size: 0.9rem; color: #fff;">${item.ticker.split(".")[0]}</div>
            <div style="font-size: 0.7rem; color: var(--muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Target: ₹${item.target_price} (₹${item.current_price})</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
            <span class="ctrl-badge" style="background: rgba(0, 255, 163, 0.15); color: var(--accent); font-size: 0.72rem; font-weight: 700; border-color: rgba(0, 255, 163, 0.3);">+${item.upside}%</span>
            <span style="font-size: 0.62rem; color: var(--info); font-weight: 600;">${item.rating}</span>
          </div>
          <div class="tooltip-content">${getExpectedResultsHTML(item.ticker)}</div>
        </div>
      `).join("");
    }
  }

  if (divList && data.dividend_stars) {
    if (!data.dividend_stars.length) {
      divList.innerHTML = `<div class="empty-state" style="padding: 16px;">No dividend data.</div>`;
    } else {
      divList.innerHTML = data.dividend_stars.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: all 0.2s;" class="hover-scale results-tooltip-container" onclick="window.showStockDetails('${item.ticker}')">
          <div style="min-width: 0; flex: 1; padding-right: 8px;">
            <div style="font-weight: 700; font-size: 0.9rem; color: #fff;">${item.ticker.split(".")[0]}</div>
            <div style="font-size: 0.7rem; color: var(--muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${item.name}</div>
          </div>
          <div style="flex-shrink: 0;">
            <span class="ctrl-badge" style="background: rgba(255, 184, 0, 0.15); color: var(--warning); font-size: 0.72rem; font-weight: 700; border-color: rgba(255, 184, 0, 0.3);">${item.yield}% Yield</span>
          </div>
          <div class="tooltip-content">${getExpectedResultsHTML(item.ticker)}</div>
        </div>
      `).join("");
    }
  }
}

window.jumpToStock = (ticker) => {
  activateTab("live");
  setTimeout(() => {
    const safeTicker = ticker.replace(/[^a-zA-Z0-9]/g, "_");
    const el = document.getElementById(`details-${safeTicker}`);
    if (el) {
      el.setAttribute("open", "");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.boxShadow = "0 0 20px var(--accent)";
      setTimeout(() => el.style.boxShadow = "", 2000);
    }
  }, 100);
};

function renderIndexBar(indices) {
  if (!indexBar) return;
  const items = Object.values(indices);
  if (!items.length) {
    indexBar.innerHTML = `<span class="muted" style="font-size: 0.8rem;">Loading indices...</span>`;
    return;
  }

  indexBar.innerHTML = items.map(idx => {
    const cls = idx.change >= 0 ? "pos" : "neg";
    const arrow = idx.change >= 0 ? "▲" : "▼";
    let ticker = "^INDIAVIX";
    if (idx.name === "NIFTY 50" || idx.name === "GIFT Nifty (Proxy)") ticker = "^NSEI";
    else if (idx.name === "BANK NIFTY") ticker = "^NSEBANK";
    else if (idx.name === "SENSEX") ticker = "^BSESN";
    
    return `
      <div class="index-item" style="cursor: pointer;" onclick="window.open('https://finance.yahoo.com/quote/${ticker}', '_blank')">
        <span class="index-name">${idx.name}</span>
        <span class="index-price">${idx.price.toLocaleString("en-IN")}</span>
        <span class="index-change ${cls}">${arrow} ${Math.abs(idx.change_pct).toFixed(2)}%</span>
      </div>
    `;
  }).join("");
}

function renderMarketStatus() {
  if (!state.marketStatus) {
    if (marketPhase) marketPhase.textContent = "Waiting...";
    if (marketSummary) marketSummary.textContent = "No market status available.";
    if (lastRefresh) lastRefresh.textContent = "Waiting...";
    return;
  }

  if (marketPhase) marketPhase.textContent = state.marketStatus.label || "Unknown";
  if (marketSummary) marketSummary.textContent =
    state.marketStatus.summary ||
    `Market open: ${Boolean(state.marketStatus.is_market_open)}`;
  if (lastRefresh) lastRefresh.textContent = formatTimestamp(state.marketStatus.updated_at);
}

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(number);
}

function formatScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function formatVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(number);
}

function formatTimestamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "N/A";
  }
  return new Date(number).toLocaleString("en-IN");
}

// Optional example write helper if you later want to save watchlists/preferences.
async function saveUserPreference(path, value) {
  if (!state.user) {
    return;
  }
  await set(ref(db, `users/${state.user.uid}/${path}`), value);
}

window.saveUserPreference = saveUserPreference;



// Quick add to portfolio (tracked holding without quantity)
window.quickAddToPortfolio = async function(ticker, currentPrice) {
  if (!state.user) {
    alert("Log in first to manage portfolio.");
    return;
  }
  const safeTicker = ticker.replace(/[^a-zA-Z0-9]/g, '_');
  const path = `users/${state.user.uid}/portfolio/${safeTicker}`;
  
  try {
    const existing = state.portfolio && state.portfolio[safeTicker];
    if (existing) {
      alert(`${ticker} is already in your Portfolio.`);
      return;
    }
    
    // Add it with quantity 0 to just track it
    await set(ref(db, path), {
      ticker: ticker,
      qty: 0,
      buyPrice: currentPrice || 0,
      updatedAt: Date.now()
    });
    alert(`Added ${ticker} to Portfolio as a tracked holding.`);
  } catch (err) {
    console.error("Failed to add to portfolio", err);
    alert("Failed to track stock in portfolio.");
  }
};

// Watchlist Logic
window.toggleWatchlist = async function(ticker) {
  if (!state.user) {
    alert("Log in first to use watchlist.");
    return;
  }
  const safeTicker = ticker.replace(/[^a-zA-Z0-9]/g, '_');
  const path = `users/${state.user.uid}/watchlist/${safeTicker}`;
  try {
    if (state.watchlist && state.watchlist[safeTicker]) {
      await remove(ref(db, path));
    } else {
      await set(ref(db, path), { ticker, addedAt: Date.now() });
    }
  } catch (err) {
    console.error("Watchlist toggle error:", err);
  }
};

function renderWatchlist() {
  const container = document.getElementById("watchlist-items");
  const count = document.getElementById("watchlist-count");
  if (!container) return;
  
  const items = Object.values(state.watchlist || {});
  if (count) count.textContent = String(items.length);
  
  if (!items.length) {
    container.innerHTML = '<p class="muted" style="font-size: 0.85rem; text-align: center;">No stocks in watchlist.</p>';
    return;
  }
  
  container.innerHTML = items.map(item => {
    const live = state.livePrices[item.ticker.replace(".", "_")] || {};
    const price = live.price || "—";
    const chg = live.change_pct || 0;
    const cls = chg >= 0 ? "positive" : "negative";
    
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; background: var(--panel-strong); padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); animation: slideUp 0.3s ease-out both;">
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
          <span style="font-weight: bold; cursor: pointer; color: var(--accent);" onclick="window.jumpToStock('${item.ticker}')">${item.ticker}</span>
          <span class="${cls}" style="font-size: 0.8rem; margin-left: 6px;">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="font-weight: 700; font-size: 0.9rem;">${formatCurrency(price)}</span>
          <button class="btn btn-ghost btn-sm" onclick="window.toggleWatchlist('${item.ticker}')" style="padding: 2px 6px; color: var(--danger); border: none; background: transparent;">×</button>
        </div>
      </div>
    `;
  }).join("");
}

// Chart Logic
let marketChartInstance = null;
function renderMarketChart(stocks) {
  const canvas = document.getElementById("marketChart");
  if (!canvas || !stocks.length) return;
  
  const buckets = {
    'Deep Red': 0,
    'Red': 0,
    'Green': 0,
    'Deep Green': 0
  };
  
  stocks.forEach(s => {
    const chg = s.change_pct || 0;
    if (chg < -2) buckets['Deep Red']++;
    else if (chg < 0) buckets['Red']++;
    else if (chg < 2) buckets['Green']++;
    else buckets['Deep Green']++;
  });
  
  const data = {
    labels: Object.keys(buckets),
    datasets: [{
      data: Object.values(buckets),
      backgroundColor: ['#ff4d4d', '#ff8585', '#34d399', '#00ffa3'],
      borderRadius: 8,
      borderWidth: 0
    }]
  };
  
  if (marketChartInstance) {
    marketChartInstance.data = data;
    marketChartInstance.update();
  } else {
    marketChartInstance = new Chart(canvas, {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        onHover: (event, chartElement) => {
          event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const label = data.labels[index];
            const typeMap = {
              'Deep Red': '<-2%',
              'Red': '-2to0%',
              'Green': '0to2%',
              'Deep Green': '>2%'
            };
            window.filterLive(typeMap[label]);
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
        }
      }
    });
  }
}

// Global Filter/Jump logic
window.jumpToStock = function(ticker) {
  activateTab("live");
  const searchInput = document.getElementById("live-search");
  if (searchInput) {
    searchInput.value = ticker;
    renderDashboard();
  }
  setTimeout(() => {
    document.getElementById("section-live")?.scrollIntoView({ behavior: 'smooth' });
  }, 100);
};

window.filterLive = function(type) {
  activateTab("live");
  const searchInput = document.getElementById("live-search");
  if (searchInput) {
    if (type === 'gainers') searchInput.value = ">0%";
    else if (type === 'losers') searchInput.value = "<0%";
    else searchInput.value = type; // Support range strings directly
    renderDashboard();
  }
  setTimeout(() => {
    document.getElementById("section-live")?.scrollIntoView({ behavior: 'smooth' });
  }, 100);
};

window.generateAIReport = async function() {
  try {
    console.log("🏥 AI Portfolio Doctor Activated (Real-Time Mode)");
    const portfolio = Object.values(state.portfolio || {});
    const panel = document.getElementById("portfolio-doctor-panel");
    const scoreEl = document.getElementById("health-score-value");
    const metricsGrid = document.getElementById("doctor-metrics-grid");
    const diagnosisEl = document.getElementById("doctor-diagnosis");
    const prescriptionEl = document.getElementById("doctor-prescription");
    const alertsEl = document.getElementById("doctor-alerts");

    if (portfolio.length === 0) {
      alert("Please add stocks to your portfolio first.");
      return;
    }

    panel.classList.remove("hidden");
    panel.style.display = "block";
    panel.style.opacity = "0.7";
    diagnosisEl.textContent = "AI is examining your holdings...";
    
    // 1. Calculate Core Metrics for AI context
    let totalInvested = 0, totalCurrent = 0;
    portfolio.forEach(p => {
      if (!p || !p.ticker) return; // Safety check
      const live = state.livePrices[p.ticker.replace(".","_")] || {price: p.buyPrice};
      totalInvested += Number(p.qty) * Number(p.buyPrice);
      totalCurrent += Number(p.qty) * Number(live.price);
    });

    const overallPnlPct = ((totalCurrent - totalInvested) / totalInvested) * 100;
    
    // 2. Call Groq for Intelligence
    const reportQuery = `
      As a Senior Institutional Analyst, perform a deep-dive audit of this portfolio:
      PORTFOLIO: ${JSON.stringify(portfolio)}
      LIVE OVERALL PNL: ${overallPnlPct.toFixed(2)}%
      MARKET CONTEXT: ${JSON.stringify(state.news.slice(0,5))}
      
      Requirements:
      1. Overall Health Score (0-100).
      2. Macro Diagnosis: High-level overview of portfolio stability and risk.
      3. Stock-Wise Analysis: For EACH holding in the portfolio, provide a 1-sentence "Analyst Take" (Technical/Fundamental outlook).
      4. Actionable Prescription: 3 specific strategic moves.
      
      Return ONLY a valid JSON object: 
      {
        "healthScore": number, 
        "diagnosis": "string", 
        "stockAnalysis": [{"ticker": "string", "take": "string"}],
        "prescription": "string"
      }
    `;

    let resultData;
    try {
      const groqRes = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: "user", content: reportQuery }],
          response_format: { type: "json_object" }
        })
      });
      const data = await groqRes.json();
      resultData = data;
    } catch (e) {
      // Try secondary local proxy if primary fails
      const groqRes2 = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: "user", content: reportQuery }],
          response_format: { type: "json_object" }
        })
      });
      resultData = await groqRes2.json();
    }

    if (!resultData || !resultData.choices) {
      console.error("AI API Error:", resultData);
      const errorMsg = resultData?.error?.message || "Invalid AI response format";
      throw new Error(`AI API Error: ${errorMsg}`);
    }

    let rawContent = resultData.choices[0].message.content;
    // Strip markdown code blocks if present
    if (rawContent.includes("```")) {
      rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    }
    
    const ai = JSON.parse(rawContent);

    // 3. UI Updates
    panel.style.opacity = "1";
    if (scoreEl) {
      scoreEl.textContent = ai.healthScore;
      scoreEl.style.color = ai.healthScore > 70 ? '#00ffa3' : (ai.healthScore > 40 ? '#fbbf24' : '#ef4444');
    }

    if (metricsGrid) {
      metricsGrid.innerHTML = `
        <div class="stat-item" style="background: rgba(255,255,255,0.01); padding: 12px; border-radius: 8px;">
          <span class="muted" style="font-size: 0.7rem;">Net Return</span>
          <div style="font-weight: 700; color: ${overallPnlPct >= 0 ? '#00ffa3' : '#ef4444'};">${overallPnlPct.toFixed(2)}%</div>
        </div>
        <div class="stat-item" style="background: rgba(255,255,255,0.01); padding: 12px; border-radius: 8px;">
          <span class="muted" style="font-size: 0.7rem;">Assets Count</span>
          <div style="font-weight: 700;">${portfolio.length} Holdings</div>
        </div>
        <div class="stat-item" style="background: rgba(255,255,255,0.01); padding: 12px; border-radius: 8px;">
          <span class="muted" style="font-size: 0.7rem;">Market Status</span>
          <div style="font-weight: 700;">${state.marketStatus?.phase || 'OPEN'}</div>
        </div>
      `;
    }

    diagnosisEl.innerHTML = ai.diagnosis.split('\n').map(l => `• ${l}`).join('<br>');
    prescriptionEl.innerHTML = ai.prescription.split('\n').map(l => `• ${l}`).join('<br>');

    // 4. Stock-Wise Deep Dive
    const stockAnalysisHtml = (ai.stockAnalysis || []).map(sa => `
      <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 10px; border-left: 3px solid var(--accent); margin-bottom: 8px;">
        <div style="font-weight: 800; font-size: 0.8rem; margin-bottom: 4px; color: var(--accent);">${sa.ticker}</div>
        <div class="muted" style="font-size: 0.85rem; line-height: 1.4;">${sa.take}</div>
      </div>
    `).join('');

    const doctorAlerts = document.getElementById("doctor-alerts");
    if (doctorAlerts) {
      doctorAlerts.innerHTML = `
        <h4 style="margin: 20px 0 12px; color: var(--text);">Stock-Wise Deep Dive</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 24px;">
          ${stockAnalysisHtml}
        </div>
        ${ai.healthScore < 50 
          ? `<div style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 10px; border-radius: 8px; font-size: 0.8rem; border: 1px solid #ef4444;">⚠️ <strong>High Risk Detected:</strong> Follow the AI prescription to safeguard capital.</div>`
          : `<div style="background: rgba(0, 255, 163, 0.1); color: #00ffa3; padding: 10px; border-radius: 8px; font-size: 0.8rem; border: 1px solid #00ffa3;">✅ <strong>Portfolio Optimized:</strong> Your strategy aligns with current market momentum.</div>`}
      `;
    }

    panel.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error("AI Doctor failed:", err);
    
    // Fallback to local intelligence if API fails
    console.log("⚡ Switching to Local Intelligence Fallback...");
    const portfolio = Object.values(state.portfolio || {});
    let totalInvested = 0, totalCurrent = 0;
    portfolio.forEach(p => {
      const live = state.livePrices[p.ticker.replace(".","_")] || {price: p.buyPrice};
      totalInvested += Number(p.qty) * Number(p.buyPrice);
      totalCurrent += Number(p.qty) * Number(live.price);
    });
    const overallPnlPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;
    
    const localAi = {
      healthScore: Math.round(Math.min(100, Math.max(0, 70 + overallPnlPct))),
      diagnosis: overallPnlPct >= 0 
        ? "Your portfolio is showing strong momentum with positive net returns. Diversification across sectors is maintaining stability."
        : "Portfolio is currently underperforming market benchmarks. High concentration in specific assets may be increasing risk exposure.",
      stockAnalysis: portfolio.map(p => {
        const live = state.livePrices[p.ticker.replace(".","_")] || {};
        const chg = live.change_pct || 0;
        let take = "";
        if (chg > 2) take = `Showing strong bullish momentum with a ${chg.toFixed(2)}% breakout. High relative strength in current trend.`;
        else if (chg > 0) take = `Holding steady with ${chg.toFixed(2)}% gain. Technical structure remains intact with positive bias.`;
        else if (chg > -2) take = `Minor consolidation (${chg.toFixed(2)}%). Found support at current levels, showing resilient behavior.`;
        else take = `Under significant pressure recently (${chg.toFixed(2)}%). Momentum is bearish; monitor support levels closely for signs of reversal.`;
        
        return { ticker: p.ticker, take };
      }),
      prescription: "1. Rebalance overweight positions to manage sector risk.\n2. Set trailing stop-losses to protect capital during volatility.\n3. Monitor high-alpha AI picks for potential entry/exit signals."
    };

    // Update UI with local data
    const panel = document.getElementById("portfolio-doctor-panel");
    const scoreEl = document.getElementById("health-score-value");
    const metricsGrid = document.getElementById("doctor-metrics-grid");
    const diagnosisEl = document.getElementById("doctor-diagnosis");
    const prescriptionEl = document.getElementById("doctor-prescription");

    panel.classList.remove("hidden");
    panel.style.display = "block";
    panel.style.opacity = "1";
    
    if (scoreEl) {
      scoreEl.textContent = localAi.healthScore;
      scoreEl.style.color = localAi.healthScore > 70 ? '#00ffa3' : (localAi.healthScore > 40 ? '#fbbf24' : '#ef4444');
    }

    if (metricsGrid) {
      metricsGrid.innerHTML = `
        <div class="stat-item" style="background: rgba(255,255,255,0.01); padding: 12px; border-radius: 8px;">
          <span class="muted" style="font-size: 0.7rem;">Net Return</span>
          <div style="font-weight: 700; color: ${overallPnlPct >= 0 ? '#00ffa3' : '#ef4444'};">${overallPnlPct.toFixed(2)}%</div>
        </div>
        <div class="stat-item" style="background: rgba(255,255,255,0.01); padding: 12px; border-radius: 8px;">
          <span class="muted" style="font-size: 0.7rem;">Assets Count</span>
          <div style="font-weight: 700;">${portfolio.length} Holdings</div>
        </div>
        <div class="stat-item" style="background: rgba(255,255,255,0.01); padding: 12px; border-radius: 8px;">
          <span class="muted" style="font-size: 0.7rem;">AI Status</span>
          <div style="font-weight: 700; color: var(--warning);">LOCAL MODE</div>
        </div>
      `;
    }

    diagnosisEl.innerHTML = `• ${localAi.diagnosis}`;
    prescriptionEl.innerHTML = localAi.prescription.split('\n').map(l => `• ${l}`).join('<br>');

    const stockAnalysisHtml = localAi.stockAnalysis.map(sa => `
      <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 10px; border-left: 3px solid var(--accent); margin-bottom: 8px;">
        <div style="font-weight: 800; font-size: 0.8rem; margin-bottom: 4px; color: var(--accent);">${sa.ticker}</div>
        <div class="muted" style="font-size: 0.85rem; line-height: 1.4;">${sa.take}</div>
      </div>
    `).join('');

    const doctorAlerts = document.getElementById("doctor-alerts");
    if (doctorAlerts) {
      doctorAlerts.innerHTML = `
        <h4 style="margin: 20px 0 12px; color: var(--text);">Stock-Wise Deep Dive (Heuristic)</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 24px;">
          ${stockAnalysisHtml}
        </div>
        <div style="background: rgba(251, 191, 36, 0.1); color: #fbbf24; padding: 10px; border-radius: 8px; font-size: 0.8rem; border: 1px solid #fbbf24;">⚠️ <strong>API Connectivity Issue:</strong> Showing heuristic analysis while AI service is unreachable.</div>
      `;
    }

    panel.scrollIntoView({ behavior: 'smooth' });
  }
};

window.toggleEarningsModal = function(show) {
  const modal = document.getElementById("earningsModal");
  if (modal) modal.classList.toggle("hidden", !show);
};

function renderEarnings() {
  const container = document.getElementById("earnings-list");
  const badge = document.getElementById("earnings-summary-badge");
  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results = Object.values(state.earnings || {}).filter(item => {
    if (!item.date) return false;
    const itemDate = new Date(item.date);
    return itemDate >= today;
  });

  if (badge) badge.textContent = `${results.length} Upcoming Results`;

  if (results.length === 0) {
    container.innerHTML = '<p class="muted" style="text-align: center;">No upcoming results tracked currently.</p>';
    return;
  }

  // Sort by date ascending (closest first)
  results.sort((a, b) => new Date(a.date) - new Date(b.date));

  container.innerHTML = results.map(item => {
    const isToday = new Date(item.date).toDateString() === new Date().toDateString();
    const impactColor = item.expected_impact === "High" ? "var(--danger)" : "var(--accent)";
    
    return `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${impactColor}; cursor: pointer; transition: all 0.2s;" class="hover-scale results-tooltip-container" onclick="window.showStockDetails('${item.ticker}')">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="font-size: 1.1rem; color: var(--accent);">${item.ticker}</strong>
            ${isToday ? '<span class="ctrl-badge" style="background: var(--danger); font-size: 0.6rem;">TODAY</span>' : ''}
            <a href="https://finance.yahoo.com/quote/${item.ticker}" target="_blank" style="text-decoration: none; font-size: 0.72rem; color: var(--info); display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;" class="hover-glow" onclick="event.stopPropagation();">
              Source ↗
            </a>
          </div>
          <div class="muted" style="font-size: 0.8rem; margin-top: 4px;">Revenue Est: ₹${formatVolume(item.revenue_avg || 0)} | EPS Est: ${item.earnings_avg || 'N/A'}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 0.95rem;">${new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
          <div style="font-size: 0.7rem; color: var(--muted); text-transform: uppercase; margin-top: 2px;">Impact: <span style="color: ${impactColor};">${item.expected_impact}</span></div>
        </div>
        <div class="tooltip-content">${getExpectedResultsHTML(item.ticker)}</div>
      </div>
    `;
  }).join("");
}

function renderFIIDII() {
  const fiiEl = document.getElementById("fii-net-flow");
  const diiEl = document.getElementById("dii-net-flow");
  const dateEl = document.getElementById("fiidii-date");
  if (!fiiEl || !diiEl || !state.fiidii) return;

  const data = state.fiidii;
  let fiiData = Array.isArray(data) ? data.find(d => d.category === "FII/FPI") : null;
  let diiData = Array.isArray(data) ? data.find(d => d.category === "DII") : null;

  if (fiiData) {
    const val = parseFloat(fiiData.netValue);
    fiiEl.textContent = `${val >= 0 ? '+' : ''}₹${val.toLocaleString('en-IN')} Cr`;
    fiiEl.style.color = val >= 0 ? "var(--accent)" : "var(--danger)";
    if (dateEl) dateEl.textContent = `Latest Data: ${fiiData.date}`;
  }

  if (diiData) {
    const val = parseFloat(diiData.netValue);
    diiEl.textContent = `${val >= 0 ? '+' : ''}₹${val.toLocaleString('en-IN')} Cr`;
    diiEl.style.color = val >= 0 ? "var(--accent)" : "var(--danger)";
  }
}

function renderCommodities(commodities) {
  const brentPrice = document.getElementById("brent-price");
  const brentChange = document.getElementById("brent-change");
  if (!brentPrice || !brentChange) return;

  // Brent Crude ticker key is BZ_F (from BZ=F)
  const brent = commodities["BZ_F"];
  if (brent) {
    brentPrice.textContent = `$${brent.price.toFixed(2)}`;
    const cls = brent.change_pct >= 0 ? "positive" : "negative";
    brentChange.textContent = `${brent.change_pct >= 0 ? '+' : ''}${brent.change_pct.toFixed(2)}%`;
    brentChange.className = cls;
  }
}

function initMobileUI() {
  const drawerToggle = document.getElementById("mobile-drawer-toggle");
  const drawerClose = document.getElementById("mobile-drawer-close");
  const drawerBackdrop = document.getElementById("mobile-drawer-backdrop");
  const drawer = document.getElementById("mobile-drawer");
  
  function openDrawer() {
    drawer?.classList.add("open");
    drawerBackdrop?.classList.add("active");
  }
  
  function closeDrawer() {
    drawer?.classList.remove("open");
    drawerBackdrop?.classList.remove("active");
  }
  
  drawerToggle?.addEventListener("click", openDrawer);
  drawerClose?.addEventListener("click", closeDrawer);
  drawerBackdrop?.addEventListener("click", closeDrawer);
  
  // Bind Drawer Navigation Links
  const drawerItems = document.querySelectorAll(".drawer-menu-item");
  drawerItems.forEach(item => {
    item.addEventListener("click", (e) => {
      const tabName = item.dataset.tab;
      if (tabName) {
        if (item.tagName === "A" && item.getAttribute("href")?.startsWith("#")) {
          e.preventDefault();
        }
        activateTab(tabName);
        closeDrawer();
      }
    });
  });
  
  // Expandable Mobile Search Toggle
  const searchToggle = document.getElementById("mobile-search-toggle");
  const searchOverlay = document.getElementById("mobile-search-overlay");
  const searchInput = document.getElementById("mobile-search-input");
  
  searchToggle?.addEventListener("click", () => {
    const isActive = searchOverlay?.classList.toggle("active");
    if (isActive) {
      searchInput?.focus();
    }
  });
  
  // Hook mobile search input to filter dashboard symbols or news
  searchInput?.addEventListener("input", (e) => {
    const val = e.target.value;
    const activeTabEl = document.querySelector(".drawer-menu-item.active, .nav-pill.active");
    const activeTab = activeTabEl?.dataset.tab || "live";
    
    if (activeTab === "news") {
      const newsInput = document.getElementById("news-input");
      if (newsInput) {
        newsInput.value = val;
        renderNews();
      }
    } else {
      const liveSearchInput = document.getElementById("live-search");
      if (liveSearchInput) {
        liveSearchInput.value = val;
        renderDashboard();
      }
    }
  });

  // Bottom Quick Action Buttons
  const actionTrade = document.getElementById("mobile-action-trade");
  const actionChat = document.getElementById("mobile-action-chat");
  const actionRefresh = document.getElementById("mobile-action-refresh");
  const drawerChatLink = document.getElementById("mobile-chat-link");
  const drawerLogoutLink = document.getElementById("mobile-logout-link");
  const drawerLoginLink = document.getElementById("mobile-login-link");
  
  actionTrade?.addEventListener("click", () => {
    window.openTxModal("buy", "");
  });
  
  function toggleAIChat(e) {
    if (e) e.preventDefault();
    const chatWin = document.getElementById("chatWindow");
    chatWin?.classList.toggle("hidden");
    closeDrawer();
  }
  
  actionChat?.addEventListener("click", toggleAIChat);
  drawerChatLink?.addEventListener("click", toggleAIChat);
  
  actionRefresh?.addEventListener("click", () => {
    actionRefresh.style.transform = "rotate(360deg)";
    actionRefresh.style.transition = "transform 0.5s ease";
    renderDashboard();
    renderNews();
    setTimeout(() => {
      actionRefresh.style.transform = "none";
      actionRefresh.style.transition = "none";
    }, 500);
  });
  
  drawerLogoutLink?.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    closeDrawer();
  });
  
  drawerLoginLink?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!state.user) {
      const authGate = document.getElementById("authGate");
      authGate?.classList.remove("hidden");
    } else {
      activateTab("profile");
    }
    closeDrawer();
  });

  // Automatically detect screen size on load/resize
  function handleScreenResize() {
    const width = window.innerWidth;
    const viewMode = localStorage.getItem("stocksense_view_mode") || "auto";
    if (viewMode === "auto") {
      const isMobile = width <= 768;
      document.body.classList.toggle("is-mobile", isMobile);
    } else {
      document.body.classList.toggle("is-mobile", viewMode === "mobile");
    }
  }
  
  window.addEventListener("resize", handleScreenResize);
  handleScreenResize();
}

// Auto-bind to ensure click works even if onclick in HTML is blocked
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const btn = document.querySelector('button[onclick*="generateAIReport"]');
    if (btn) {
      btn.onclick = null; // Remove inline
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        window.generateAIReport();
      });
      console.log("✅ AI Smart Report Button Bound");
    }
  }, 1000);
  // Init UI
  const savedLang = localStorage.getItem("stocksense_lang") || "en";
  setLanguage(savedLang);
  const langSelector = document.getElementById("languageSelect");
  if (langSelector) langSelector.value = savedLang;

  const savedMode = localStorage.getItem("stocksense_view_mode") || "auto";
  window.setViewMode(savedMode);
  
  // Initialize mobile interactions
  initMobileUI();
});

console.log("🚀 StockSense App Engine Loaded Successfully");