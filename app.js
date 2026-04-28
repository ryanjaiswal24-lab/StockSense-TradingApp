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
  signOut
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
  newsLimit: 5
};

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

loginBtn?.addEventListener("click", async () => {
  if (authStatus) authStatus.textContent = "Opening Google sign-in...";
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (authStatus) authStatus.textContent = error.message;
    console.error("Login error:", error);
  }
});

gateLoginBtn?.addEventListener("click", async () => {
  const gateAuthStatus = document.getElementById("gateAuthStatus");
  if (gateAuthStatus) gateAuthStatus.textContent = "Opening Google sign-in...";
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (gateAuthStatus) gateAuthStatus.textContent = error.message;
    console.error("Login error:", error);
  }
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
        state.profile.availableBalance = 100000; // Default mock balance
        update(ref(db, `users/${state.user.uid}/profile`), { availableBalance: 100000 });
      }
      renderAvailableBalance();
    });
  }
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
    if (!item || !item.ticker) return ""; // Skip invalid items
    const liveData = state.livePrices[item.ticker.replace(".", "_")] || {};
    const currentPrice = liveData.price || item.buyPrice;
    const changePct = liveData.change_pct || 0;
    
    const invested = Number(item.qty || 0) * Number(item.buyPrice || 0);
    const currentValue = Number(item.qty || 0) * currentPrice;
    const pnl = currentValue - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    
    // Day gain calculation: Gain = Value - (Value / (1 + changePct/100))
    const dayGain = currentValue - (currentValue / (1 + changePct / 100));

    totalInvested += invested;
    totalCurrentValue += currentValue;
    totalDayGain += dayGain;

    const pnlCls = pnl >= 0 ? "positive" : "negative";
    const safeTicker = item.ticker.replace(/[^a-zA-Z0-9]/g, '_');

    return `
      <tr>
        <td style="cursor: pointer; font-weight: bold;" onclick="window.open('https://finance.yahoo.com/quote/${item.ticker}', '_blank')">
          ${item.ticker}<br><span class="muted" style="font-size: 0.8rem; font-weight: normal;">${liveData.name || 'Stock'}</span>
        </td>
        <td>${item.qty}</td>
        <td>${formatCurrency(item.buyPrice)}</td>
        <td>${formatCurrency(currentPrice)}</td>
        <td style="font-weight: 500;">${formatCurrency(currentValue)}</td>
        <td>
          <div class="${pnlCls}" style="font-weight: bold;">${formatCurrency(pnl)}</div>
          <div class="${pnlCls}" style="font-size: 0.85rem;">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</div>
        </td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-ghost btn-sm" onclick="window.openTxModal('buy', '${item.ticker}')" style="color: #34d399;" title="Buy More">Buy</button>
            <button class="btn btn-ghost btn-sm" onclick="window.openTxModal('sell', '${item.ticker}')" style="color: #ff4d4d;" title="Sell">Sell</button>
          </div>
        </td>
      </tr>
    `;
  });

  portTbody.innerHTML = rows.join("") || '<tr><td colspan="7" class="muted" style="text-align:center;">No holdings yet. Buy your first stock!</td></tr>';
  
  // Update summary cards
  if (pmInvested) pmInvested.textContent = formatCurrency(totalInvested);
  if (pmCurrent) pmCurrent.textContent = formatCurrency(totalCurrentValue);
  const totalPnL = totalCurrentValue - totalInvested;
  if (pmPnL) {
    pmPnL.textContent = formatCurrency(totalPnL);
    pmPnL.className = `pm-val ${totalPnL >= 0 ? "positive" : "negative"}`;
  }
  if (pmDayGain) {
    pmDayGain.textContent = formatCurrency(totalDayGain);
    pmDayGain.className = `pm-val ${totalDayGain >= 0 ? "positive" : "negative"}`;
  }

  // Trigger charts and insights update
  if (window.Chart) {
    renderAllocationChart(portfolio);
    renderPerformanceChart(totalCurrentValue);
  }
  renderAIInsights(portfolio);
}

function renderAvailableBalance() {
  const availBalanceEl = document.getElementById("avail-balance");
  if (availBalanceEl) {
    availBalanceEl.textContent = formatCurrency(state.profile.availableBalance || 0);
  }
}

function renderTransactions() {
  const container = document.getElementById("transactions-container");
  if (!container) return;
  const txs = Object.values(state.transactions || {}).sort((a, b) => b.timestamp - a.timestamp);
  
  if (txs.length === 0) {
    container.innerHTML = '<p class="muted" style="text-align: center; margin-top: 20px;">No transactions yet.</p>';
    return;
  }

  container.innerHTML = txs.map(tx => {
    const isBuy = tx.type === "buy";
    const date = new Date(tx.timestamp).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return `
      <div class="transaction-row">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="tx-icon ${isBuy ? 'tx-buy' : 'tx-sell'}">${isBuy ? 'B' : 'S'}</div>
          <div>
            <div style="font-weight: bold; font-size: 1rem;">${tx.ticker.replace("_", ".")}</div>
            <div class="muted" style="font-size: 0.8rem;">${date}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: bold;">${isBuy ? '-' : '+'}${formatCurrency(tx.value)}</div>
          <div class="muted" style="font-size: 0.8rem;">${tx.qty} @ ${formatCurrency(tx.price)}</div>
        </div>
      </div>
    `;
  }).join("");
}

// Chart Instances
let portChartInst = null;
let allocChartInst = null;

function renderPerformanceChart(currentValue) {
  const ctx = document.getElementById('portfolioChart');
  if (!ctx) return;
  
  // Generate synthetic historical curve ending at currentValue for demo
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dataPoints = [];
  let simulatedValue = currentValue * 0.7; // Start 30% lower a year ago
  for(let i=0; i<11; i++) {
    dataPoints.push(simulatedValue);
    simulatedValue += (Math.random() - 0.3) * (currentValue * 0.1); // Upward bias random walk
  }
  dataPoints.push(currentValue); // Ensure it ends exactly at current value

  if (portChartInst) {
    portChartInst.data.datasets[0].data = dataPoints;
    portChartInst.update();
    return;
  }

  portChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Portfolio Value',
        data: dataPoints,
        borderColor: '#34d399',
        backgroundColor: 'rgba(52, 211, 153, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false, color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa' } }
      },
      interaction: { intersect: false, mode: 'index' }
    }
  });
}

function renderAllocationChart(portfolio) {
  const ctx = document.getElementById('allocationChart');
  if (!ctx) return;

  const sectorMap = {};
  Object.values(portfolio).forEach(item => {
    if (!item || !item.ticker) return;
    const live = state.livePrices[item.ticker.replace(".", "_")] || {};
    const sector = live.sector || "Other";
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
      cutout: '70%',
      plugins: {
        legend: { position: 'right', labels: { color: '#a1a1aa', boxWidth: 12, padding: 15 } }
      }
    }
  });
}

function renderAIInsights(portfolio) {
  const container = document.getElementById("ai-insights-container");
  const needle = document.getElementById("risk-needle");
  const scoreLabel = document.getElementById("risk-score");
  const divScore = document.getElementById("div-score");
  if (!container) return;

  const items = Object.values(portfolio);
  if (items.length === 0) {
    container.innerHTML = '<p class="muted" style="text-align: center;">Buy stocks to generate AI insights.</p>';
    if (needle) needle.style.transform = `rotate(0deg)`; // Safe
    if (scoreLabel) scoreLabel.textContent = "Safe";
    if (divScore) divScore.textContent = "0/10";
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
  const divScoreNum = Math.min(10, Math.max(1, Math.floor(sectors.length * 2))); // Basic score
  
  if (divScore) divScore.textContent = `${divScoreNum}/10`;

  let riskAngle = 45; // Moderate
  let riskText = "Moderate";
  
  let insightsHtml = "";

  if (sectors.length <= 2) {
    insightsHtml += `<div class="insight-item"><span class="insight-icon">⚠️</span><div><strong>Low Diversification</strong><p class="muted" style="font-size: 0.85rem; margin-top: 4px;">You are heavily concentrated in ${sectors.length} sector(s). Consider adding stocks from different industries.</p></div></div>`;
    riskAngle = 135; // High Risk
    riskText = "High Risk";
  } else if (sectors.length >= 5) {
    insightsHtml += `<div class="insight-item"><span class="insight-icon">✅</span><div><strong>Excellent Diversification</strong><p class="muted" style="font-size: 0.85rem; margin-top: 4px;">Your portfolio is well spread across multiple sectors, reducing unsystematic risk.</p></div></div>`;
    riskAngle = -45; // Safe
    riskText = "Safe";
  }

  // Find max exposure
  let maxSector = "";
  let maxPct = 0;
  for (const [sec, val] of Object.entries(sectorMap)) {
    const pct = val / totalValue;
    if (pct > maxPct) { maxPct = pct; maxSector = sec; }
  }

  if (maxPct > 0.4) {
    insightsHtml += `<div class="insight-item"><span class="insight-icon">🏦</span><div><strong>Overexposed to ${maxSector}</strong><p class="muted" style="font-size: 0.85rem; margin-top: 4px;">${(maxPct*100).toFixed(1)}% of your capital is in ${maxSector}. A downturn in this sector could heavily impact you.</p></div></div>`;
    riskAngle = Math.max(riskAngle, 90);
    riskText = riskAngle > 90 ? "High Risk" : "Moderate";
  } else {
    insightsHtml += `<div class="insight-item"><span class="insight-icon">💡</span><div><strong>Balanced Allocation</strong><p class="muted" style="font-size: 0.85rem; margin-top: 4px;">No single sector dominates your portfolio (>40%). Great risk management.</p></div></div>`;
  }

  container.innerHTML = insightsHtml;
  if (needle) needle.style.transform = `rotate(${riskAngle}deg)`;
  if (scoreLabel) {
    scoreLabel.textContent = riskText;
    scoreLabel.style.color = riskText === "Safe" ? "#34d399" : (riskText === "High Risk" ? "#ff4d4d" : "#fbbf24");
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
      const safeTicker = stock.ticker.replace(/[^a-zA-Z0-9]/g, '_');
      
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
              <div class="scrip-stat"><span class="muted">AI Score:</span> <strong>${aiScore}</strong></div>
              <div class="scrip-stat"><span class="muted">Signal:</span> <strong style="color: var(--accent);">${signals}</strong></div>
              <div class="scrip-stat"><span class="muted">Sector:</span> <strong>${stock.sector || "N/A"}</strong></div>
            </div>
              <div class="scrip-actions" style="width: 100%; margin-top: 12px; display: flex; justify-content: flex-end; align-items: center; gap: 12px; border-top: 1px solid var(--line); padding-top: 12px;">
                <button class="btn btn-ghost btn-sm" onclick="window.open('https://finance.yahoo.com/quote/${stock.ticker}', '_blank')">📈 Chart</button>
                <button class="btn btn-ghost btn-sm" onclick="window.toggleWatchlist('${stock.ticker}')">${state.watchlist[safeTicker] ? '⭐ Remove' : '☆ Watchlist'}</button>
                <button class="btn btn-ghost btn-sm" id="btn-train-${safeTicker}" onclick="window.requestAITrain('${stock.ticker}')">Train AI</button>
                <button class="btn btn-primary btn-sm" onclick="window.quickAddToPortfolio('${stock.ticker}', ${stock.price})">+ Track in Portfolio</button>
              </div>
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
    newsGrid.innerHTML = emptyState("No news found.");
    return;
  }

  const visibleNews = filtered.slice(0, state.newsLimit);
  
  const newsHtml = visibleNews
    .map((item) => {
      return `
        <details class="news-accordion" onmouseenter="this.setAttribute('open', '')" onmouseleave="this.removeAttribute('open')">
          <summary class="news-summary">
            <h4>${item.title || "Untitled story"}</h4>
            <div class="news-meta">
              <span>${item.source || "Yahoo Finance"}</span>
              <span>•</span>
              <span>${formatTimestamp(item.updated_at)}</span>
            </div>
          </summary>
          <div class="news-details">
            <a href="${item.link || '#'}" target="_blank" class="btn btn-primary" style="display: inline-block; margin-top: 8px;">Read Full Article</a>
          </div>
        </details>
      `;
    })
    .join("");

  let loadMoreHtml = "";
  if (filtered.length > state.newsLimit) {
    loadMoreHtml = `<button id="btn-load-more-news" class="btn btn-ghost" style="width: 100%; margin-top: 12px;">Load More News</button>`;
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
  let picks = Object.values(state.aiPicks);
  
  if (!picks.length) {
    // Fallback: Show Top Gainers as "Trending Now" if AI picks are not ready
    const stocks = Object.keys(state.stocks).map(ticker => ({
      ticker,
      ...state.stocks[ticker],
      ...(state.livePrices[ticker.replace(".", "_")] || {})
    }));
    
    if (stocks.length > 0) {
      picks = stocks
        .sort((a, b) => (b.change_pct || 0) - (a.change_pct || 0))
        .slice(0, 10)
        .map(s => ({
          ...s,
          isTrending: true
        }));
    } else {
      aiGrid.innerHTML = emptyState("AI Model is currently analyzing the market. Check back soon.");
      return;
    }
  }

  aiGrid.innerHTML = picks
    .map((stock) => {
      const signal = stock.isTrending ? "Trending" : (Array.isArray(stock.signals) ? stock.signals.join(", ") : "Bullish");
      const scoreLabel = stock.isTrending ? "Change" : "AI Score";
      const scoreValue = stock.isTrending ? `${(stock.change_pct || 0).toFixed(2)}%` : formatScore(stock.ml);
      const colorCls = (stock.change_pct || 0) >= 0 ? "positive" : "negative";

      return `
        <article class="price-card" style="border-left: 4px solid var(--accent); cursor: pointer;" onclick="window.jumpToStock('${stock.ticker}')">
          <p class="eyebrow">${stock.isTrending ? "🔥 Trending Now" : "🤖 AI Suggestion"}</p>
          <h4 style="margin-top: 4px;">${stock.ticker}</h4>
          <p class="price-value ${colorCls}">${formatCurrency(stock.price)}</p>
          <div class="price-row"><span>Sector</span><span>${stock.sector || "N/A"}</span></div>
          <div class="price-row"><span>Signal</span><span style="color: var(--accent); font-weight: bold;">${signal}</span></div>
          <div class="price-row"><span>${scoreLabel}</span><span class="${colorCls}">${scoreValue}</span></div>
          <div style="margin-top: 12px; font-size: 0.8rem; color: var(--accent); text-align: right;">View Details →</div>
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

// Chat logic
const chatToggle = document.getElementById("btn-chat-toggle");
const chatClose = document.getElementById("btn-chat-close");
const chatWindow = document.getElementById("ai-chat-window");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("btn-chat-send");
const chatMessages = document.getElementById("chat-messages");

if (chatToggle && chatClose && chatWindow) {
  chatToggle.addEventListener("click", () => {
    chatWindow.classList.remove("hidden");
    chatToggle.style.display = "none";
    chatInput.focus();
  });
  chatClose.addEventListener("click", () => {
    chatWindow.classList.add("hidden");
    chatToggle.style.display = "flex";
  });
}

function addChatMessage(sender, text) {
  if (!chatMessages) return;
  const div = document.createElement("div");
  div.style.padding = "8px 12px";
  div.style.borderRadius = "8px";
  div.style.maxWidth = "85%";
  div.style.wordWrap = "break-word";
  
  if (sender === "user") {
    div.style.alignSelf = "flex-end";
    div.style.background = "var(--accent)";
    div.style.color = "#fff";
  } else {
    div.style.alignSelf = "flex-start";
    div.style.background = "var(--bg)";
    div.style.border = "1px solid var(--line)";
    div.style.color = "var(--text)";
  }
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function processChatCommand(msg) {
  const text = msg.toLowerCase();
  
  if (text.includes("portfolio")) {
    if (!state.user || !state.portfolio) return "Please log in and ensure your portfolio is loaded.";
    const items = Object.values(state.portfolio);
    if (items.length === 0) return "Your portfolio is currently empty.";
    const totalVal = items.reduce((acc, item) => acc + (Number(item.qty)*Number(item.buyPrice)), 0);
    return `You have ${items.length} stocks in your portfolio. Your invested value is roughly ${formatCurrency(totalVal)}. Check the Portfolio tab for live P&L updates!`;
  }
  
  if (text.includes("top") || text.includes("pick") || text.includes("buy")) {
    const picks = Object.values(state.aiPicks || {});
    if (picks.length === 0) return "The AI is currently analyzing the market. No picks yet.";
    const top3 = picks.sort((a,b)=> (b.ml||0) - (a.ml||0)).slice(0, 3).map(p => `${p.ticker} (Score: ${formatScore(p.ml)})`).join(", ");
    return `The strongest buy signals right now are: ${top3}`;
  }
  
  if (text.includes("sector") || text.includes("crashing")) {
    return "Check the Sector Heatmap on the right sidebar to see which sectors are doing the best or worst today!";
  }
  
  if (text.includes("hello") || text.includes("hi")) {
    return "Hello! I am your StockSense AI. I can tell you about the top AI picks or your portfolio. What do you want to know?";
  }
  
  return "I'm a simple local AI bot. Try asking me for 'top picks' or about your 'portfolio'.";
}

if (chatSend && chatInput) {
  chatSend.addEventListener("click", () => {
    const text = chatInput.value.trim();
    if (!text) return;
    addChatMessage("user", text);
    chatInput.value = "";
    
    setTimeout(() => {
      const response = processChatCommand(text);
      addChatMessage("bot", response);
    }, 500);
  });
  
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") chatSend.click();
  });
}

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