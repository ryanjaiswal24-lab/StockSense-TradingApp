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
        print("✅ Firebase Connected (AI Predictor)")

def calculate_composite_score(symbol, info, history):
    """
    Generates a 0-100 score based on Technicals, Fundamentals, and Sentiment.
    """
    score = 0
    reasons = []
    
    # 1. Technical Analysis (40 points)
    try:
        df = history.copy()
        df.ta.rsi(append=True)
        df.ta.macd(append=True)
        df.ta.ema(length=20, append=True)
        df.ta.ema(length=50, append=True)
        
        last = df.iloc[-1]
        
        # RSI (10 pts)
        rsi = last.get('RSI_14', 50)
        if 40 <= rsi <= 60: score += 5; reasons.append("RSI Neutral")
        elif 30 <= rsi < 40: score += 8; reasons.append("RSI Oversold")
        elif rsi < 30: score += 10; reasons.append("RSI Extremely Oversold")
        elif 60 < rsi <= 70: score += 7; reasons.append("RSI Strong")
        
        # MACD (10 pts)
        macd = last.get('MACDH_12_26_9', 0)
        if macd > 0: score += 10; reasons.append("MACD Bullish")
        
        # EMA Cross (10 pts)
        ema20 = last.get('EMA_20', 0)
        ema50 = last.get('EMA_50', 0)
        if ema20 > ema50: score += 10; reasons.append("Golden Cross (EMA)")
        
        # Volume Spike (10 pts)
        avg_vol = df['Volume'].tail(20).mean()
        if last['Volume'] > avg_vol * 1.5: score += 10; reasons.append("High Volume Breakout")
    except Exception as e:
        print(f"Tech Error {symbol}: {e}")

    # 2. Fundamental Analysis (30 points)
    try:
        # PE Ratio (10 pts)
        pe = info.get('trailingPE', 0)
        if 0 < pe < 20: score += 10; reasons.append("Undervalued (Low PE)")
        elif 20 <= pe < 40: score += 5; reasons.append("Fair Valuation")
        
        # ROE (10 pts)
        roe = info.get('returnOnEquity', 0)
        if roe > 0.2: score += 10; reasons.append("High ROE (>20%)")
        elif roe > 0.1: score += 5; reasons.append("Healthy ROE")
        
        # Debt to Equity (10 pts)
        debt = info.get('debtToEquity', 100)
        if debt < 50: score += 10; reasons.append("Low Debt")
        elif debt < 100: score += 5; reasons.append("Manageable Debt")
    except: pass

    # 3. Momentum & Sector (30 points)
    try:
        price = history['Close'].iloc[-1]
        h52 = info.get('fiftyTwoWeekHigh', price)
        dist_from_high = (h52 - price) / h52
        if dist_from_high < 0.1: score += 15; reasons.append("Near 52W High")
        
        # Sentiment (Simplified)
        news = yf.Ticker(symbol).news
        sentiment_score = 0
        if news:
            for n in news[:3]:
                blob = TextBlob(n.get('title', ''))
                sentiment_score += blob.sentiment.polarity
        if sentiment_score > 0: score += 15; reasons.append("Positive Sentiment")
    except: pass

    # Normalize
    final_score = min(100, score)
    label = "Weak"
    if final_score >= 80: label = "Strong Buy"
    elif final_score >= 65: label = "Bullish"
    elif final_score >= 50: label = "Watchlist"
    
    return {
        "score": final_score,
        "label": label,
        "reasons": reasons[:3],
        "confidence": 85 if final_score > 70 else 70
    }

def run_ai_predictor():
    init_firebase()
    
    # Track top Nifty stocks for AI analysis
    WATCHLIST = [
        "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
        "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS",
        "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "TITAN.NS",
        "AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"
    ]
    
    print(f"🧠 AI Predictor: Analyzing {len(WATCHLIST)} core assets...")
    
    while True:
        results = {}
        for symbol in WATCHLIST:
            try:
                t = yf.Ticker(symbol)
                hist = t.history(period="60d")
                if hist.empty: continue
                
                analysis = calculate_composite_score(symbol, t.info, hist)
                
                safe_key = symbol.replace(".", "_")
                results[safe_key] = {
                    "ticker": symbol,
                    "score": analysis["score"],
                    "label": analysis["label"],
                    "reasons": analysis["reasons"],
                    "confidence": analysis["confidence"],
                    "updated_at": int(time.time() * 1000)
                }
                print(f"📊 Analyzed {symbol}: {analysis['score']} ({analysis['label']})")
                time.sleep(1) # Rate limit friendly
            except Exception as e:
                print(f"❌ Error analyzing {symbol}: {e}")
        
        if results:
            db.reference("ai_picks").set(results)
            print("✅ AI Picks updated in Firebase.")
        
        # AI runs every 1 hour (less frequent than live engine)
        time.sleep(3600)

if __name__ == "__main__":
    run_ai_predictor()