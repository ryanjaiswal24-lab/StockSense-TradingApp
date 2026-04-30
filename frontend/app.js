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
const provider = new GoogleAuthProvider();

const state = {
  user: null,
  stocks: {},
  livePrices: {},
  news: [],
  marketStatus: null,
  aiPicks: {},
  watchlist: {},
  portfolio: {},
  transactions: {},
  profile: {},
  listenersStarted: false,
  newsLimit: 5,
  language: 'en'
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
    ? "background: var(--panel-strong); padding: 8px 12px; border-radius: 12px 12px 12px 0; max-width: 85%; align-self: flex-start; font-size: 0.9rem;"
    : "background: var(--accent); color: #04100a; padding: 8px 12px; border-radius: 12px 12px 0 12px; max-width: 85%; align-self: flex-end; font-size: 0.9rem; font-weight: 600;";
  div.textContent = text;
  chatMessages?.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleChat() {
  const text = chatInput.value.trim();
  if(!text) return;
  chatInput.value = "";
  addChatMessage("user", text);

  setTimeout(() => {
    const response = getAIResponse(text.toLowerCase());
    addChatMessage("bot", response);
  }, 600);
}

function getAIResponse(query) {
  const stocks = Object.values(state.livePrices);
  const portfolio = Object.values(state.portfolio || {});
  
  // 1. Hyper-Detailed Portfolio Deep Dive
  if (query.includes("analyze my portfolio") || query.includes("portfolio health") || query.includes("deep dive")) {
    if (portfolio.length === 0) return "Your portfolio is empty. Add stocks to unlock deep AI insights!";
    
    let totalInvested = 0, totalCurrent = 0, gainers = 0, losers = 0;
    const sectors = {};
    let weakestStock = null;
    let worstPnl = 0;

    portfolio.forEach(p => {
      const live = state.livePrices[p.ticker.replace(".","_")] || {price: p.buyPrice};
      const invested = Number(p.qty) * Number(p.buyPrice);
      const current = Number(p.qty) * Number(live.price);
      const pnl = current - invested;
      
      totalInvested += invested;
      totalCurrent += current;
      if(pnl > 0) gainers++; else losers++;
      
      if(pnl < worstPnl) { worstPnl = pnl; weakestStock = p.ticker; }
      
      const sec = p.sector || "Other";
      sectors[sec] = (sectors[sec] || 0) + current;
    });

    const pnlTotal = totalCurrent - totalInvested;
    const pnlPct = (pnlTotal / totalInvested) * 100;
    const diversificationScore = Math.min(10, Object.keys(sectors).length * 2);
    
    let report = `📊 DEEP DIVE ANALYSIS:\n`;
    report += `• Returns: ${formatCurrency(pnlTotal)} (${pnlPct.toFixed(2)}%)\n`;
    report += `• Risk Profile: ${gainers} Gainers vs ${losers} Losers. `;
    report += (gainers > losers) ? "Strong momentum! " : "Portfolio is currently under pressure. ";
    report += `\n• Diversification Score: ${diversificationScore}/10. `;
    
    if (diversificationScore < 6) report += "Caution: You are too concentrated in a few sectors. Spread into 3+ sectors to reduce risk. ";
    
    if (weakestStock) {
      report += `\n• Weakest Link: ${weakestStock} is your biggest drag. Consider if the fundamental reason for holding still exists.`;
    }

    report += `\n\n💡 RECOMMENDATION: `;
    if (pnlPct > 5) report += "To make this better, use 'Trailing Stop Losses' of 5% on your gainers to protect these profits while allowing more upside.";
    else report += "To improve profitability, exit stocks with AI scores < 0.4 and re-allocate to 'Bullish' sector leaders.";
    
    return report;
  }

  // 2. Profitability Strategy
  if (query.includes("profitable") || query.includes("strategy") || query.includes("make money")) {
    return "To maximize profitability with StockSense: \n1. Focus on 'Value Gems': Stocks with AI Scores > 0.70 AND P/E Ratios under 25. \n2. Sector Rotation: When the 'Average Move' on your dashboard is negative, move into defensive sectors like IT or Pharma. \n3. Risk Management: Never allocate more than 15% of your capital to a single stock.";
  }

  // 3. Valuation & AI Picks (Existing)
  if(query.includes("valuation") || query.includes("pe ratio") || query.includes("p/e")) {
    const cheap = stocks.filter(s => s.pe > 0 && s.pe < 25).slice(0, 3);
    if(cheap.length > 0) {
      return `Based on live valuations, ${cheap.map(s => s.ticker).join(", ")} are currently trading at a P/E below 25. This could indicate under-valuation.`;
    }
    return "Most stocks are currently trading at fair market valuations.";
  }

  if(query.includes("best") || query.includes("buy") || query.includes("suggest")) {
    const top = Object.values(state.aiPicks || {}).sort((a,b) => b.ml - a.ml).slice(0, 2);
    if(top.length > 0) {
      return `My models highlight ${top.map(s => s.ticker).join(" and ")} as top technical picks.`;
    }
  }

  const tickerMatch = stocks.find(s => query.includes(s.ticker.toLowerCase().split(".")[0]));
  if(tickerMatch) {
    const ml = state.aiPicks[tickerMatch.ticker.replace(".","_")]?.ml || "Neutral";
    return `${tickerMatch.ticker} is at ${formatCurrency(tickerMatch.price)}. P/E: ${tickerMatch.pe || 'N/A'}. Trend: ${ml >= 0.7 ? 'Strongly Bullish' : (ml >= 0.55 ? 'Bullish' : 'Neutral')}.`;
  }

  return "I can analyze your 'portfolio health', suggest 'profitable strategies', or check stock valuations. What can I help with?";
}


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

document.getElementById("guestLoginBtn")?.addEventListener("click", () => {
  if (authGate) authGate.classList.add("hidden");
  appShell?.classList.remove("hidden");
  startListeners();
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



document.querySelectorAll(".nav-pill").forEach((button) => {
  button.addEventListener("click", (e) => {
    e.preventDefault();
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
  document.querySelectorAll(".nav-pill").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  document.querySelectorAll(".page-section").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `section-${tabName}`);
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

  onValue(ref(db, "market_indices"), (snapshot) => {
    const indices = snapshot.val() || {};
    renderIndexBar(indices);
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
        state.profile.availableBalance = 1000000000; // Unlimited Mode
        update(ref(db, `users/${state.user.uid}/profile`), { availableBalance: 1000000000 });
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
  const txs = Object.values(state.transactions || {}).sort((a, b) => b.timestamp - a.timestamp);
  
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
}

function applyAccent(accent) {
  document.body.dataset.accent = accent;
}

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

function renderNews() {
  if (!newsGrid) return;
  
  const query = newsInput?.value.toLowerCase().trim() || "";
  let filtered = state.news || [];
  if (query) {
    filtered = filtered.filter(item => (item.title || "").toLowerCase().includes(query) || (item.source || "").toLowerCase().includes(query));
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
    
    return `
      <article class="news-card-premium" onclick="window.open('${n.link}', '_blank')">
        <div class="news-content">
          <div class="news-meta">
            <span class="news-source">${n.source || 'Finance'}</span>
            <span class="news-time"><span class="live-indicator"></span>${timeDisplay}</span>
          </div>
          <h3 class="news-title">${n.title}</h3>
          <p class="news-excerpt">${n.summary || (state.language === 'hi' ? 'इस बाज़ार घटना पर पूरी इंटेलिजेंस रिपोर्ट पढ़ने के लिए क्लिक करें।' : 'Click to read full intelligence report on this market event.')}</p>
          <div class="news-footer">
            <span class="news-tag">${state.language === 'hi' ? 'बाज़ार अंतर्दृष्टि' : 'MARKET INSIGHT'}</span>
            <span class="read-more">${state.language === 'hi' ? 'पूरी रिपोर्ट पढ़ें' : 'Read Full Report'} →</span>
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

  aiGrid.innerHTML = picks
    .sort((a, b) => b.score - a.score)
    .map((stock) => {
      const labelCls = (stock.label || "").toLowerCase().replace(" ", "-");
      const score = stock.score || 0;
      const reasons = Array.isArray(stock.reasons) ? stock.reasons.map(r => `<span class="sig sig-b">${r}</span>`).join("") : "";

      return `
        <article class="price-card" style="border-left: 4px solid var(--accent); cursor: pointer;" onclick="window.jumpToStock('${stock.ticker}')">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <p class="eyebrow">🤖 AI Intelligence</p>
            <span class="ai-label ${labelCls}">${stock.label || "Neutral"}</span>
          </div>
          <h4 style="margin-top: 8px;">${stock.ticker}</h4>
          <div style="margin: 12px 0;">
            <div style="font-size: 0.75rem; color: var(--muted); margin-bottom: 4px;">Composite Score</div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                <div style="width: ${score}%; height: 100%; background: var(--accent); box-shadow: 0 0 10px var(--accent);"></div>
              </div>
              <span style="font-size: 1.2rem; font-weight: 900; color: var(--accent);">${score}</span>
            </div>
          </div>
          <div class="pc-sigs" style="margin-top: 8px;">${reasons}</div>
          <div style="margin-top: 16px; font-size: 0.75rem; color: var(--muted); display: flex; justify-content: space-between;">
            <span>Confidence: ${stock.confidence}%</span>
            <span style="color: var(--accent);">Analysis Details →</span>
          </div>
        </article>
      `;
    })
    .join("");
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
    renderDashboard();
  }
  setTimeout(() => {
    document.getElementById("section-live")?.scrollIntoView({ behavior: 'smooth' });
  }, 100);
};

window.generateAIReport = function() {
  try {
    console.log("🏥 AI Portfolio Doctor Activated");
    const portfolio = Object.values(state.portfolio || {});
    const panel = document.getElementById("portfolio-doctor-panel");
    const scoreEl = document.getElementById("health-score-value");
    const metricsGrid = document.getElementById("doctor-metrics-grid");
    const diagnosisEl = document.getElementById("doctor-diagnosis");
    const prescriptionEl = document.getElementById("doctor-prescription");
    const alertsEl = document.getElementById("doctor-alerts");

    if (!panel) {
      console.error("Doctor panel not found");
      return;
    }

    if (portfolio.length === 0) {
      alert("Please add stocks to your portfolio first.");
      return;
    }

    panel.classList.remove("hidden");
    panel.style.display = "block";
    
    // 1. Core Calculations
    let totalInvested = 0, totalCurrent = 0, winners = 0;
    const sectors = {};
    let leader = { ticker: 'N/A', gain: -Infinity };
    let laggard = { ticker: 'N/A', gain: Infinity };

    portfolio.forEach(p => {
      try {
        const live = state.livePrices[p.ticker.replace(".","_")] || {price: p.buyPrice};
        const invested = Number(p.qty) * Number(p.buyPrice);
        const current = Number(p.qty) * Number(live.price);
        const pnl = current - invested;
        const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

        totalInvested += invested;
        totalCurrent += current;
        if (pnl > 0) winners++;
        
        if (pnlPct > leader.gain) leader = { ticker: p.ticker, gain: pnlPct };
        if (pnlPct < laggard.gain) laggard = { ticker: p.ticker, gain: pnlPct };

        const sec = p.sector || "Other";
        sectors[sec] = (sectors[sec] || 0) + current;
      } catch (e) { console.warn("Error processing stock:", p.ticker, e); }
    });

    if (totalInvested === 0) {
      alert("Portfolio valuation error. Please check your holdings.");
      return;
    }

    const overallPnlPct = ((totalCurrent - totalInvested) / totalInvested) * 100;
    
    // 2. Intelligence Logic
    const sectorKeys = Object.keys(sectors);
    const diversification = sectorKeys.length;
    const topSector = sectorKeys.length > 0 ? sectorKeys[0] : "None";
    const healthScore = Math.round(
      Math.min(100, (winners / portfolio.length * 40) + (Math.min(5, diversification) * 10) + (overallPnlPct > 0 ? 10 : 0) + (portfolio.length > 3 ? 10 : 0))
    );

    // 3. UI Updates
    if (scoreEl) {
      scoreEl.textContent = healthScore;
      scoreEl.style.color = healthScore > 70 ? '#00ffa3' : (healthScore > 40 ? '#fbbf24' : '#ef4444');
    }

    if (metricsGrid) {
      metricsGrid.innerHTML = `
        <div class="stat-item" style="background: rgba(255,255,255,0.01); padding: 12px; border-radius: 8px;">
          <span class="muted" style="font-size: 0.7rem;">Market Leader</span>
          <div style="font-weight: 700; color: #00ffa3;">${leader.ticker} (${leader.gain > -Infinity ? '+' + leader.gain.toFixed(1) + '%' : '0%'})</div>
        </div>
        <div class="stat-item" style="background: rgba(255,255,255,0.01); padding: 12px; border-radius: 8px;">
          <span class="muted" style="font-size: 0.7rem;">Risk Factor</span>
          <div style="font-weight: 700; color: ${diversification < 3 ? '#ef4444' : '#34d399'};">${diversification < 3 ? 'High' : 'Low'}</div>
        </div>
        <div class="stat-item" style="background: rgba(255,255,255,0.01); padding: 12px; border-radius: 8px;">
          <span class="muted" style="font-size: 0.7rem;">Sector Focus</span>
          <div style="font-weight: 700;">${topSector} (${((sectors[topSector] / totalCurrent) * 100).toFixed(0)}%)</div>
        </div>
      `;
    }

    if (diagnosisEl) {
      diagnosisEl.innerHTML = `
        • Your portfolio health score is <strong>${healthScore}/100</strong>. <br>
        • <strong>Sector Bias:</strong> You are heavily weighted in ${topSector}. Any industry-specific correction will impact you significantly. <br>
        • <strong>The Drag:</strong> ${laggard.ticker} is currently your weakest holding with a ${laggard.gain < Infinity ? laggard.gain.toFixed(1) : '0'}% drawdown.
      `;
    }

    if (prescriptionEl) {
      prescriptionEl.innerHTML = `
        • <strong>Rebalance Suggestion:</strong> Trim 10% from ${leader.ticker !== 'N/A' ? leader.ticker : 'leaders'} to book profits and re-allocate into a defensive sector. <br>
        • <strong>Exit Strategy:</strong> Set a strict stop-loss for ${laggard.ticker !== 'N/A' ? laggard.ticker : 'laggards'} to prevent further capital erosion. <br>
        • <strong>Next Move:</strong> Look for stocks with high AI scores to improve your win rate.
      `;
    }

    if (alertsEl) {
      alertsEl.innerHTML = overallPnlPct > 10 
        ? `<div style="background: rgba(0, 255, 163, 0.1); color: #00ffa3; padding: 10px; border-radius: 8px; font-size: 0.8rem; border: 1px solid #00ffa3;">🚀 <strong>Profit Booking Opportunity:</strong> Your portfolio is up ${overallPnlPct.toFixed(1)}%. Consider taking some gains.</div>`
        : `<div style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 10px; border-radius: 8px; font-size: 0.8rem; border: 1px solid #ef4444;">⚠️ <strong>Risk Alert:</strong> Diversification is low. Add more sectors to reach an "Optimal" rating.</div>`;
    }

    panel.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error("AI Doctor failed:", err);
    alert("Financial intelligence engine encountered an error. Please try again.");
  }
};

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
});

console.log("🚀 StockSense App Engine Loaded Successfully");