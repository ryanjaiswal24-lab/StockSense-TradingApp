import json
import os
import time
import warnings
from datetime import datetime, timezone
import pandas as pd
import yfinance as yf
import firebase_admin
from firebase_admin import credentials, db

warnings.filterwarnings('ignore')

DATABASE_URL = os.getenv(
    "FIREBASE_DATABASE_URL",
    "https://stockscene-560d7-default-rtdb.asia-southeast1.firebasedatabase.app",
)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT", os.path.join(BASE_DIR, "serviceAccountKey.json"))

# Core indices to track
INDICES = {
    "^NSEI": "NIFTY 50",
    "^BSESN": "SENSEX",
    "^NSEBANK": "BANK NIFTY",
    "^INDIAVIX": "INDIA VIX"
}

# Key stocks for high-frequency updates
HOT_STOCKS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS",
    "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "TITAN.NS"
]

def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
        print("✅ Firebase Connected (Live Engine)")

def get_market_status():
    """Detects if NSE is open (9:15 AM - 3:30 PM IST, Mon-Fri)"""
    now = datetime.now(timezone.utc)
    # IST is UTC+5:30
    ist_now = now + pd.Timedelta(hours=5, minutes=30)
    
    is_weekday = ist_now.weekday() < 5
    market_start = ist_now.replace(hour=9, minute=15, second=0, microsecond=0)
    market_end = ist_now.replace(hour=15, minute=30, second=0, microsecond=0)
    
    if is_weekday and market_start <= ist_now <= market_end:
        return "OPEN", "Market is trading live"
    elif is_weekday and ist_now < market_start:
        return "PRE-OPEN", "Market opens at 9:15 AM"
    else:
        return "CLOSED", "Market is closed"

def fetch_live_data():
    symbols = list(INDICES.keys()) + HOT_STOCKS
    try:
        data = yf.download(symbols, period="1d", interval="1m", group_by="ticker", threads=True, progress=False)
        
        updates = {}
        index_updates = {}
        
        for s in symbols:
            try:
                hist = data[s].dropna() if len(symbols) > 1 else data.dropna()
                if hist.empty: continue
                
                price = float(hist['Close'].iloc[-1])
                prev_close = float(hist['Open'].iloc[0]) # Simplified for 1d/1m
                change = price - prev_close
                change_pct = (change / prev_close) * 100 if prev_close else 0
                
                payload = {
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "high": round(float(hist['High'].max()), 2),
                    "low": round(float(hist['Low'].min()), 2),
                    "volume": int(hist['Volume'].iloc[-1]),
                    "updated_at": int(time.time() * 1000)
                }
                
                safe_key = s.replace("^", "").replace(".", "_")
                if s in INDICES:
                    payload["name"] = INDICES[s]
                    index_updates[safe_key] = payload
                else:
                    updates[safe_key] = payload
            except: continue
            
        return updates, index_updates
    except Exception as e:
        print(f"❌ Fetch Error: {e}")
        return {}, {}

def run_engine():
    init_firebase()
    print("🚀 Starting High-Frequency Market Engine...")
    
    while True:
        status, summary = get_market_status()
        db.reference("market_status").set({
            "phase": status,
            "summary": summary,
            "updated_at": int(time.time() * 1000)
        })
        
        live_stocks, live_indices = fetch_live_data()
        
        if live_stocks:
            db.reference("live_prices").update(live_stocks)
        if live_indices:
            db.reference("market_indices").set(live_indices)
            
            # Calculate simple index sentiment
            nifty = live_indices.get("NSEI", {})
            nifty_change = nifty.get("change_pct", 0)
            sentiment = "Neutral"
            if nifty_change > 0.5: sentiment = "Bullish"
            elif nifty_change < -0.5: sentiment = "Bearish"
            
            db.reference("market_sentiment").set({
                "index": "NIFTY 50",
                "sentiment": sentiment,
                "change_pct": nifty_change
            })

        # Calculate gainers/losers from live_stocks
        g = len([s for s in live_stocks.values() if s.get('change_pct', 0) > 0])
        l = len([s for s in live_stocks.values() if s.get('change_pct', 0) < 0])
        db.reference("market_breadth").set({
            "gainers": g,
            "losers": l,
            "updated_at": int(time.time() * 1000)
        })

        print(f"📡 Sync Complete | Status: {status} | Gainers: {g} | Losers: {l}")
        time.sleep(10) # 10 second refresh

if __name__ == "__main__":
    run_engine()
