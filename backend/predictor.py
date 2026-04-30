import json
import os
import time
import warnings
import sys
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, db
import pandas as pd
import numpy as np
try:
    import pandas_ta as ta
    from textblob import TextBlob
except ImportError:
    pass

import yfinance as yf

warnings.filterwarnings('ignore')

DATABASE_URL = os.getenv(
    "FIREBASE_DATABASE_URL",
    "https://stockscene-560d7-default-rtdb.asia-southeast1.firebasedatabase.app",
)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT", os.path.join(BASE_DIR, "serviceAccountKey.json"))

def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
        print("[OK] Firebase Connected (AI Predictor)")

def calculate_composite_score(symbol, info, history):
    """
    Generates a 0-100 score based on Technicals, Fundamentals, and Sentiment.
    """
    score = 0
    reasons = []
    
    # 1. Technical Analysis (45 points)
    try:
        df = history.copy()
        if len(df) > 50:
            # Manual RSI
            delta = df['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['RSI_14'] = 100 - (100 / (1 + rs))
            
            # Manual MACD
            exp1 = df['Close'].ewm(span=12, adjust=False).mean()
            exp2 = df['Close'].ewm(span=26, adjust=False).mean()
            macd = exp1 - exp2
            signal = macd.ewm(span=9, adjust=False).mean()
            df['MACDH'] = macd - signal
            
            # Manual EMA
            df['EMA_20'] = df['Close'].ewm(span=20, adjust=False).mean()
            df['EMA_50'] = df['Close'].ewm(span=50, adjust=False).mean()
            
            last = df.iloc[-1]
            
            # RSI (15 pts)
            rsi = last.get('RSI_14', 50)
            if 30 <= rsi <= 40: 
                score += 15; reasons.append("RSI Oversold (Value Zone)")
            elif 40 < rsi <= 60: 
                score += 8; reasons.append("RSI Healthy Momentum")
            elif rsi < 30: 
                score += 10; reasons.append("RSI Extremely Oversold")
            
            # MACD (15 pts)
            macd_h = last.get('MACDH', 0)
            if macd_h > 0: 
                score += 15; reasons.append("MACD Bullish Crossover")
            
            # EMA Cross (15 pts)
            ema20 = last.get('EMA_20', 0)
            ema50 = last.get('EMA_50', 0)
            if ema20 > ema50: 
                score += 15; reasons.append("Bullish EMA Trend")
        else:
            score += 20; reasons.append("Limited History (Accumulating)")
    except Exception as e:
        print(f"Tech Error {symbol}: {e}")

    # 2. Fundamental Analysis (35 points)
    try:
        # PE Ratio (15 pts)
        pe = info.get('trailingPE', info.get('forwardPE', 0))
        if 0 < pe < 25: 
            score += 15; reasons.append("Attractive Valuation (Low PE)")
        elif 25 <= pe < 50: 
            score += 8; reasons.append("Fair Valuation")
        
        # Growth (10 pts)
        growth = info.get('revenueGrowth', 0)
        if growth > 0.1: 
            score += 10; reasons.append("Strong Revenue Growth")
        
        # Margin (10 pts)
        margin = info.get('profitMargins', 0)
        if margin > 0.15: 
            score += 10; reasons.append("High Profitability")
    except: pass

    # 3. Sentiment (20 points)
    try:
        news = yf.Ticker(symbol).news
        sentiment_val = 0
        if news:
            for n in news[:5]:
                blob = TextBlob(n.get('title', ''))
                sentiment_val += blob.sentiment.polarity
        
        if sentiment_val > 0.2: 
            score += 20; reasons.append("High News Sentiment")
        elif sentiment_val > 0: 
            score += 10; reasons.append("Positive Sentiment")
    except: pass

    # Normalize
    final_score = min(100, score)
    label = "Neutral"
    if final_score >= 80: label = "Strong Buy"
    elif final_score >= 65: label = "Bullish"
    elif final_score >= 45: label = "Watchlist"
    else: label = "Weak"
    
    return {
        "score": final_score,
        "label": label,
        "reasons": reasons[:3],
        "confidence": 85 if final_score > 70 else 70,
        "sector": info.get('sector', 'Other'),
        "name": info.get('longName', symbol)
    }

def run_ai_predictor():
    init_firebase()
    
    # Expanded Indian Watchlist for better coverage
    WATCHLIST = [
        "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
        "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS",
        "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "TITAN.NS",
        "TATASTEEL.NS", "BAJFINANCE.NS", "WIPRO.NS", "HCLTECH.NS", "ADANIENT.NS",
        "SUNPHARMA.NS", "JSWSTEEL.NS", "NTPC.NS", "TATAMOTORS.NS", "POWERGRID.NS",
        "ADANIPORTS.NS", "COALINDIA.NS", "BAJAJFINSV.NS", "EICHERMOT.NS", "INDUSINDBK.NS",
        "ULTRACEMCO.NS", "GRASIM.NS", "HDFCLIFE.NS", "SBILIFE.NS", "DRREDDY.NS",
        "CIPLA.NS", "NESTLEIND.NS", "BRITANNIA.NS", "TECHM.NS", "M&M.NS"
    ]
    
    print(f"AI Predictor: Analyzing {len(WATCHLIST)} Indian Blue Chips...")
    
    while True:
        results = {}
        stock_info = {}
        for symbol in WATCHLIST:
            try:
                t = yf.Ticker(symbol)
                info = {}
                try:
                    info = t.info
                    if not info: info = {}
                except:
                    # Fallback to fast_info or empty if info fails
                    print(f"[Warn] Could not fetch detailed info for {symbol}, falling back to history-only analysis.")
                
                hist = t.history(period="120d")
                if hist.empty: 
                    print(f"Skipping {symbol}: No historical data available")
                    continue
                
                analysis = calculate_composite_score(symbol, info, hist)
                
                safe_key = symbol.replace(".", "_")
                results[safe_key] = {
                    "ticker": symbol,
                    "score": analysis["score"],
                    "label": analysis["label"],
                    "reasons": analysis["reasons"],
                    "confidence": analysis["confidence"],
                    "updated_at": int(time.time() * 1000)
                }
                
                stock_info[safe_key] = {
                    "ticker": symbol,
                    "name": analysis["name"],
                    "sector": analysis["sector"],
                    "updated_at": int(time.time() * 1000)
                }
                
                print(f"Analysis {symbol}: {analysis['score']} [{analysis['label']}] Sector: {analysis['sector']}")
                time.sleep(1) # More conservative rate limit
            except Exception as e:
                print(f"[Error] Error analyzing {symbol}: {e}")
        
        if results:
            db.reference("ai_picks").set(results)
            db.reference("stocks").update(stock_info)
            print("[OK] AI Picks & Sector Info updated in Firebase.")
        
        time.sleep(1800)

if __name__ == "__main__":
    run_ai_predictor()