"""
StockSense Combined Backend Engine
─────────────────────────────────────────────
Responsibilities:
 - Real-time Market Data Sync (Live Engine)
 - AI Stock Analysis & Scoring (Predictor)
 - Groq AI Chat Proxy (Flask Server)
 - Firebase RTDB Integration (Admin SDK)

Run with: python main.py
"""

import os
import time
import json
import warnings
import threading
import logging
from datetime import datetime, timezone

import requests
import pandas as pd
import yfinance as yf
from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
from waitress import serve

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("backend.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Sentiment and Tech analysis
try:
    from textblob import TextBlob
except ImportError:
    TextBlob = None

warnings.filterwarnings('ignore')

# --- Configuration ---
DATABASE_URL = os.getenv(
    "FIREBASE_DATABASE_URL",
    "https://stockscene-560d7-default-rtdb.asia-southeast1.firebasedatabase.app",
)
# Search for serviceAccountKey.json in root or current dir
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT", os.path.join(BASE_DIR, "serviceAccountKey.json"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# --- Constants ---
INDICES = {
    "^NSEI": "NIFTY 50",
    "^BSESN": "SENSEX",
    "^NSEBANK": "BANK NIFTY",
    "^INDIAVIX": "INDIA VIX"
}

NIFTY_CORE = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS"
]

NIFTY_ROTATION = [
    "KOTAKBANK.NS", "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "TITAN.NS",
    "TATASTEEL.NS", "BAJFINANCE.NS", "WIPRO.NS", "HCLTECH.NS", "ADANIENT.NS",
    "SUNPHARMA.NS", "JSWSTEEL.NS", "NTPC.NS", "POWERGRID.NS",
    "ADANIPORTS.NS", "COALINDIA.NS", "BAJAJFINSV.NS", "EICHERMOT.NS", "INDUSINDBK.NS",
    "ULTRACEMCO.NS", "GRASIM.NS", "HDFCLIFE.NS", "SBILIFE.NS", "DRREDDY.NS",
    "CIPLA.NS", "NESTLEIND.NS", "BRITANNIA.NS", "TECHM.NS", "M&M.NS",
    "APOLLOHOSP.NS", "DIVISLAB.NS", "HINDALCO.NS", "BPCL.NS",
    "HEROMOTOCO.NS", "ONGC.NS", "UPL.NS"
]

PREDICTOR_WATCHLIST = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS",
    "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "TITAN.NS",
    "TATASTEEL.NS", "BAJFINANCE.NS", "WIPRO.NS", "HCLTECH.NS", "ADANIENT.NS",
    "SUNPHARMA.NS", "JSWSTEEL.NS", "NTPC.NS", "TATAMOTORS.NS", "TATAMOTORS_PV.NS", "TATAMOTORS_CV.NS", "POWERGRID.NS",
    "ADANIPORTS.NS", "COALINDIA.NS", "BAJAJFINSV.NS", "EICHERMOT.NS", "INDUSINDBK.NS",
    "ULTRACEMCO.NS", "GRASIM.NS", "HDFCLIFE.NS", "SBILIFE.NS", "DRREDDY.NS",
    "CIPLA.NS", "NESTLEIND.NS", "BRITANNIA.NS", "TECHM.NS", "M&M.NS"
]

NIFTY_50 = list(set(NIFTY_CORE + NIFTY_ROTATION))

# --- Firebase Initialization ---
def init_firebase():
    if not firebase_admin._apps:
        try:
            if os.path.exists(SERVICE_ACCOUNT_PATH):
                cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
                firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
                logger.info(f"Firebase Connected using {SERVICE_ACCOUNT_PATH}")
            else:
                firebase_admin.initialize_app(options={"databaseURL": DATABASE_URL})
                logger.info("Firebase Connected (Default Credentials)")
        except Exception as e:
            logger.error(f"Firebase connection failed: {e}")

# --- AI Predictor Logic ---
def calculate_composite_score(symbol, info, history, market_context=None):
    score = 0
    reasons = []
    
    # Market Context Adjustment
    market_sentiment = market_context.get("sentiment", "Neutral") if market_context else "Neutral"
    nifty_pct = market_context.get("change_pct", 0) if market_context else 0

    try:
        df = history.copy()
        if len(df) > 50:
            delta = df['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['RSI_14'] = 100 - (100 / (1 + rs))
            exp1 = df['Close'].ewm(span=12, adjust=False).mean()
            exp2 = df['Close'].ewm(span=26, adjust=False).mean()
            macd = exp1 - exp2
            signal = macd.ewm(span=9, adjust=False).mean()
            df['MACDH'] = macd - signal
            df['EMA_20'] = df['Close'].ewm(span=20, adjust=False).mean()
            df['EMA_50'] = df['Close'].ewm(span=50, adjust=False).mean()
            df['MA20'] = df['Close'].rolling(window=20).mean()
            df['STD20'] = df['Close'].rolling(window=20).std()
            df['Upper'] = df['MA20'] + (df['STD20'] * 2)
            df['Lower'] = df['MA20'] - (df['STD20'] * 2)
            last = df.iloc[-1]
            rsi = last.get('RSI_14', 50)
            
            # Technical Scoring
            if 30 <= rsi <= 40: score += 15; reasons.append("RSI value entry zone")
            elif 40 < rsi <= 60: score += 8; reasons.append("Steady momentum")
            elif rsi < 30: score += 10; reasons.append("Deep oversold reversal")
            
            if last.get('MACDH', 0) > 0: score += 15; reasons.append("MACD bullish momentum")
            if last.get('EMA_20', 0) > last.get('EMA_50', 0): 
                score += 15; reasons.append("Golden trend structure")
            
            if last['Close'] < last['Lower']:
                score += 10; reasons.append("Price below lower band")
            elif last['Close'] > last['Upper']:
                score -= 5; reasons.append("Overextended rally")
                
            # Support / Resistance (Simple calculation)
            support = float(df['Low'].rolling(window=60).min().iloc[-1])
            resistance = float(df['High'].rolling(window=60).max().iloc[-1])
            
            # Volatility (20d annualized)
            returns = df['Close'].pct_change().dropna()
            volatility = float(returns.tail(20).std() * (252**0.5) * 100) if len(returns) >= 20 else 0
            
            # Today's Performance check
            today_change = ((last['Close'] - df.iloc[-2]['Close']) / df.iloc[-2]['Close']) * 100 if len(df) > 1 else 0
            if today_change > 2: score += 10; reasons.append("High volume breakout")
            elif today_change < -2: score -= 10; reasons.append("Heavy selling pressure")
            
        else:
            score += 20; reasons.append("Early stage accumulation")
            support, resistance, volatility = last['Close'] * 0.95, last['Close'] * 1.05, 0
    except Exception as e:
        logger.error(f"Scoring Error {symbol}: {e}")
        support, resistance, volatility = 0, 0, 0

    try:
        pe = info.get('trailingPE', info.get('forwardPE', 0))
        if 0 < pe < 20: score += 20; reasons.append("Undervalued vs Peers")
        elif 20 <= pe < 40: score += 10; reasons.append("Fair market pricing")
        if info.get('revenueGrowth', 0) > 0.15: 
            score += 15; reasons.append("High-velocity revenue")
        if info.get('profitMargins', 0) > 0.2:
            score += 10; reasons.append("Elite operational efficiency")
    except: pass

    # Apply Market Context Penalty/Bonus
    if market_sentiment == "Bearish":
        score -= 15
        reasons.append("Overall market weakness")
    elif market_sentiment == "Bullish":
        score += 5
        reasons.append("Market tailwinds")

    final_score = max(0, min(100, score))
    quality_score = 0
    try:
        if pe > 0 and pe < 25: quality_score += 40
        if info.get('revenueGrowth', 0) > 0.1: quality_score += 30
        if info.get('profitMargins', 0) > 0.1: quality_score += 30
    except: pass
    
    if final_score >= 85: label = "Alpha Pick"
    elif final_score >= 70: label = "Growth Buy"
    elif final_score >= 50: label = "Strategic Hold"
    elif final_score >= 35: label = "Speculative Watch"
    else: label = "Avoid / Underperform"
    
    return {
        "score": final_score, "label": label, "reasons": reasons[:3],
        "confidence": 90 if final_score > 80 else 75,
        "quality_score": quality_score,
        "sector": info.get('sector', 'Emerging Sector'), 
        "name": info.get('longName', symbol),
        "sup": round(support, 2),
        "res": round(resistance, 2),
        "volatility": round(volatility, 2),
        "w52_high": info.get('fiftyTwoWeekHigh', resistance),
        "w52_low": info.get('fiftyTwoWeekLow', support)
    }

def run_ai_predictor_loop():
    logger.info("AI Predictor Thread started.")
    while True:
        try:
            results, stock_info, raw_metrics_list = {}, {}, []
            # Fetch current market context for better suggestions
            market_context = db.reference("market_sentiment").get() or {"sentiment": "Neutral", "change_pct": 0}
            
            # Dynamic AI Analysis for User Portfolio
            user_tickers = []
            try:
                users_data = db.reference("users").get()
                if users_data:
                    for uid, data in users_data.items():
                        portfolio = data.get("portfolio", {})
                        for t_key, p_item in portfolio.items():
                            t = p_item.get("ticker")
                            if t and t not in user_tickers:
                                user_tickers.append(t)
            except: pass

            combined_watchlist = list(set(PREDICTOR_WATCHLIST + user_tickers))

            for symbol in combined_watchlist:
                try:
                    fetch_symbol = symbol
                    is_tata_sub = False
                    if symbol in ["TATAMOTORS_PV.NS", "TATAMOTORS_CV.NS"]:
                        fetch_symbol = "TATAMOTORS.NS"
                        is_tata_sub = True

                    t = yf.Ticker(fetch_symbol)
                    info = t.info or {}
                    hist = t.history(period="120d")
                    if hist.empty: continue

                    if is_tata_sub:
                        info = dict(info)
                        if symbol == "TATAMOTORS_PV.NS":
                            info['longName'] = "Tata Motors Passenger Vehicles"
                            info['revenueGrowth'] = (info.get('revenueGrowth') or 0.12) * 1.15
                            info['earningsGrowth'] = (info.get('earningsGrowth') or 0.15) * 1.25
                            info['targetMeanPrice'] = (info.get('currentPrice') or info.get('regularMarketPrice') or 950) * 1.35
                            info['recommendationKey'] = "strong_buy"
                        else:
                            info['longName'] = "Tata Motors Commercial Vehicles"
                            info['revenueGrowth'] = (info.get('revenueGrowth') or 0.12) * 0.95
                            info['earningsGrowth'] = (info.get('earningsGrowth') or 0.15) * 0.85
                            info['targetMeanPrice'] = (info.get('currentPrice') or info.get('regularMarketPrice') or 950) * 1.15
                            info['recommendationKey'] = "buy"

                    analysis = calculate_composite_score(symbol, info, hist, market_context)
                    safe_key = symbol.replace(".", "_")
                    results[safe_key] = {
                        "ticker": symbol, "score": analysis["score"], "label": analysis["label"],
                        "reasons": analysis["reasons"], "confidence": analysis["confidence"],
                        "quality_score": analysis.get("quality_score", 0),
                        "updated_at": int(time.time() * 1000)
                    }
                    stock_info[safe_key] = {
                        "ticker": symbol, "name": analysis["name"], "sector": analysis["sector"],
                        "ml": analysis["score"],
                        "signals": analysis["reasons"],
                        "sup": analysis["sup"], "res": analysis["res"],
                        "volatility": analysis["volatility"],
                        "w52_high": analysis["w52_high"], "w52_low": analysis["w52_low"],
                        "h52": analysis["w52_high"], "l52": analysis["w52_low"],
                        "updated_at": int(time.time() * 1000)
                    }
                    
                    # Curated metrics aggregation
                    name = info.get('longName', symbol)
                    rev_growth = info.get('revenueGrowth')
                    earn_growth = info.get('earningsGrowth') or info.get('earningsQuarterlyGrowth')
                    margin = info.get('profitMargins')
                    target_price = info.get('targetMeanPrice')
                    curr_price = info.get('currentPrice') or info.get('regularMarketPrice')
                    recommendation = info.get('recommendationKey')
                    div_yield = info.get('dividendYield')
                    if not div_yield and info.get('trailingAnnualDividendYield'):
                        div_yield = info.get('trailingAnnualDividendYield') * 100
                    
                    raw_metrics_list.append({
                        "ticker": symbol,
                        "name": name,
                        "revenue_growth": rev_growth,
                        "earnings_growth": earn_growth,
                        "margin": margin,
                        "target_price": target_price,
                        "current_price": curr_price,
                        "recommendation": recommendation,
                        "dividend_yield": div_yield
                    })
                    
                    time.sleep(0.5)
                except Exception as e:
                    logger.debug(f"Error processing {symbol}: {e}")
                    continue
            if results:
                db.reference("ai_picks").set(results)
                db.reference("stocks").update(stock_info)
                
                # Process Curated Groups
                best_performers = []
                potential_stars = []
                dividend_stars = []
                
                for item in raw_metrics_list:
                    ticker = item["ticker"]
                    name = item["name"]
                    
                    # 1. Best Performers (Yearly & Quarterly Results)
                    rev_g = item["revenue_growth"] if item["revenue_growth"] is not None else 0
                    earn_g = item["earnings_growth"] if item["earnings_growth"] is not None else 0
                    marg = item["margin"] if item["margin"] is not None else 0
                    if rev_g > 0 or earn_g > 0:
                        perf_score = (rev_g * 0.4 + earn_g * 0.4) * (1.0 + marg)
                        best_performers.append({
                            "ticker": ticker,
                            "name": name,
                            "revenue_growth": round(rev_g * 100, 1),
                            "earnings_growth": round(earn_g * 100, 1),
                            "margin": round(marg * 100, 1),
                            "perf_score": perf_score
                        })
                    
                    # 2. Potential Stars (Future good results potential)
                    t_price = item["target_price"]
                    c_price = item["current_price"]
                    rec = item["recommendation"]
                    if t_price and c_price and t_price > c_price:
                        upside = ((t_price - c_price) / c_price) * 100
                        if upside > 5 or rec in ["buy", "strong_buy"]:
                            potential_stars.append({
                                "ticker": ticker,
                                "name": name,
                                "upside": round(upside, 1),
                                "target_price": round(t_price, 2),
                                "current_price": round(c_price, 2),
                                "rating": (rec.replace("_", " ").title() if rec else "N/A")
                            })
                    
                    # 3. Dividend Stars
                    d_yield = item["dividend_yield"]
                    if d_yield and d_yield > 0:
                        norm_yield = d_yield if d_yield > 0.5 else d_yield * 100
                        dividend_stars.append({
                            "ticker": ticker,
                            "name": name,
                            "yield": round(norm_yield, 2)
                        })
                
                # Sort and slice top 6
                best_performers = sorted(best_performers, key=lambda x: x["perf_score"], reverse=True)[:6]
                potential_stars = sorted(potential_stars, key=lambda x: x["upside"], reverse=True)[:6]
                dividend_stars = sorted(dividend_stars, key=lambda x: x["yield"], reverse=True)[:6]
                
                curated_picks = {
                    "best_performers": best_performers,
                    "potential_stars": potential_stars,
                    "dividend_stars": dividend_stars,
                    "updated_at": int(time.time() * 1000)
                }
                db.reference("market_intelligence/curated_picks").set(curated_picks)
                
                # Generate a Global AI Suggestion
                pulse = "Market is currently " + market_context.get("sentiment", "stable") + "."
                if market_context.get("sentiment") == "Bearish":
                    advice = "Preserve cash. Wait for strong support levels before new entries."
                    color = "red"
                elif market_context.get("sentiment") == "Bullish":
                    advice = "Momentum is strong. Look for breakouts in high-quality stocks."
                    color = "green"
                else:
                    advice = "Stock-specific action is key. Avoid over-leveraging."
                    color = "yellow"
                
                db.reference("ai_market_suggestion").set({
                    "pulse": pulse,
                    "advice": advice,
                    "color": color,
                    "updated_at": int(time.time() * 1000)
                })
                
                logger.info("AI Analysis and Market Suggestion Updated.")
        except Exception as e:
            logger.error(f"Predictor Loop Error: {e}")
        
        # --- Upcoming Earnings Tracker (Nifty 500 Expansion) ---
        try:
            if not hasattr(run_ai_predictor_loop, "nifty_500_list"):
                try:
                    df_500 = pd.read_csv(os.path.join(BASE_DIR, "nifty500.csv"))
                    run_ai_predictor_loop.nifty_500_list = [f"{s}.NS" for s in df_500['Symbol'].tolist() if isinstance(s, str)]
                    run_ai_predictor_loop.rot_idx = 0
                    logger.info(f"Loaded {len(run_ai_predictor_loop.nifty_500_list)} tickers for Nifty 500 Earnings Tracker")
                except Exception as e:
                    logger.error(f"Failed to load nifty500.csv: {e}")
                    run_ai_predictor_loop.nifty_500_list = NIFTY_50 # Fallback
            
            tickers_to_check = run_ai_predictor_loop.nifty_500_list
            batch_size = 20
            start = run_ai_predictor_loop.rot_idx
            chunk = tickers_to_check[start : start + batch_size]
            run_ai_predictor_loop.rot_idx = (start + batch_size) % len(tickers_to_check)
            
            earnings_data = {}
            for symbol in chunk:
                try:
                    t = yf.Ticker(symbol)
                    cal = t.calendar
                    if cal and 'Earnings Date' in cal:
                        e_date = cal['Earnings Date'][0]
                        from datetime import date, datetime
                        today = date.today()
                        
                        if isinstance(e_date, datetime):
                            e_date = e_date.date()
                            
                        safe_key = symbol.replace(".", "_")
                        
                        if isinstance(e_date, date) and e_date >= today:
                            date_str = str(e_date)
                            earnings_data[safe_key] = {
                                "ticker": symbol,
                                "date": date_str,
                                "expected_impact": "High" if symbol in ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS"] else "Medium",
                                "revenue_avg": cal.get('Revenue Average', 0),
                                "earnings_avg": cal.get('Earnings Average', 0),
                                "updated_at": int(time.time() * 1000)
                            }
                        else:
                            try:
                                db.reference(f"upcoming_results/{safe_key}").delete()
                            except:
                                pass
                except: continue
                time.sleep(0.4)
            if earnings_data:
                db.reference("upcoming_results").update(earnings_data)
                logger.info(f"Nifty 500 Earnings Batch Complete | Updated: {len(earnings_data)} stocks")
        except Exception as e:
            logger.error(f"Earnings Tracker Error: {e}")

        # --- FII / DII Flow Tracker ---
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.nseindia.com/reports/fii-dii',
            }
            session = requests.Session()
            session.get("https://www.nseindia.com/reports/fii-dii", headers=headers, timeout=10)
            res = session.get("https://www.nseindia.com/api/fiidiiTradeReact", headers=headers, timeout=10)
            if res.status_code == 200:
                fii_dii = res.json()
                db.reference("market_intelligence/fii_dii").set(fii_dii)
                logger.info("FII/DII Data Updated Successfully")
        except Exception as e:
            logger.error(f"FII/DII Tracker Error: {e}")

        time.sleep(600) # Every 10 mins

def get_market_status():
    now = datetime.now(timezone.utc)
    ist_now = now + pd.Timedelta(hours=5, minutes=30)
    is_weekday = ist_now.weekday() < 5
    m_start = ist_now.replace(hour=9, minute=15, second=0, microsecond=0)
    m_end = ist_now.replace(hour=15, minute=30, second=0, microsecond=0)
    if is_weekday and m_start <= ist_now <= m_end: return "OPEN", "Market Live"
    return "CLOSED", "Market Closed"

def get_headline_sentiment(title, summary=""):
    text = (title + " " + summary).lower()
    
    # Financial indicators of very great results (Bullish)
    bullish_keywords = [
        'surge', 'jump', 'gain', 'profit', 'beat', 'growth', 'bullish', 
        'positive', 'rally', 'upgrade', 'climb', 'soar', 'strong', 'higher',
        'record high', 'expand', 'exceed', 'outperform', 'recovery', 'revival',
        'dividend', 'acquisition', 'partner', 'success', 'grew', 'doubled',
        'tripled', 'upbeat', 'high', 'optimistic'
    ]
    
    # Financial indicators of very bad results (Bearish)
    bearish_keywords = [
        'drop', 'fall', 'loss', 'crash', 'miss', 'slump', 'bearish',
        'negative', 'downgrade', 'decline', 'plunge', 'weak', 'lower', 'hit',
        'slashed', 'shrink', 'underperform', 'deficit', 'debt', 'fine',
        'penalty', 'lawsuit', 'investigation', 'scam', 'fraud', 'crisis',
        'fell', 'slums', 'recession', 'sluggish', 'sink'
    ]
    
    bull_score = sum(text.count(w) for w in bullish_keywords)
    bear_score = sum(text.count(w) for w in bearish_keywords)
    
    # Use TextBlob if available to improve accuracy
    if TextBlob:
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            if polarity > 0.15:
                bull_score += 2
            elif polarity < -0.15:
                bear_score += 2
        except:
            pass
            
    if bull_score > bear_score:
        return "Bullish"
    elif bear_score > bull_score:
        return "Bearish"
    return "Neutral"

def generate_ai_news(live_stocks):
    """
    Fetches real news from yfinance for Nifty Core tickers and indices
    and provides actual links to the source.
    """
    try:
        all_news = []
        # Tickers to fetch news for
        news_sources = list(INDICES.keys()) + NIFTY_CORE
        
        # Rotate sources: Pick 6 sources each time to stay fresh without hitting rate limits
        if not hasattr(generate_ai_news, "rot_idx"):
            generate_ai_news.rot_idx = 0
        
        start = generate_ai_news.rot_idx
        chunk = (news_sources[start:] + news_sources[:start])[:8]
        generate_ai_news.rot_idx = (start + 8) % len(news_sources)
 
        logger.info(f"Fetching news for batch: {chunk}")
 
        for symbol in chunk:
            try:
                t = yf.Ticker(symbol)
                news_items = t.news
                if not news_items: continue
                
                for item in news_items:
                    # Handle both old and new yfinance news formats
                    content = item.get('content', item)
                    
                    title = content.get('title', content.get('summary', ''))
                    if not title or title == 'None': continue
                    
                    # Prevent duplicates
                    if any(n['title'] == title for n in all_news): continue
                    
                    # Extract link
                    link = content.get('link', '')
                    if not link:
                        link = content.get('clickThroughUrl', {}).get('url', '')
                    if not link:
                        link = content.get('canonicalUrl', {}).get('url', '')
                    if not link: continue
                    
                    # Source / Publisher
                    source = content.get('publisher', content.get('provider', {}).get('displayName', 'Market News'))
                    
                    # Timestamp
                    pub_time = content.get('providerPublishTime')
                    if not pub_time:
                        pub_date = content.get('pubDate')
                        if pub_date:
                            try:
                                dt = datetime.strptime(pub_date, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                                pub_time = int(dt.timestamp())
                            except:
                                pub_time = int(time.time())
                        else:
                            pub_time = int(time.time())
 
                    summary_text = content.get('summary', '') or content.get('body', '') or ''
                    sentiment_label = get_headline_sentiment(title, summary_text)

                    all_news.append({
                        "title": title,
                        "source": source,
                        "link": link,
                        "category": "Global Market" if symbol in INDICES else "Indian Market",
                        "sentiment": sentiment_label,
                        "summary": summary_text[:180] + "..." if len(summary_text) > 180 else summary_text,
                        "updated_at": pub_time * 1000
                    })
            except Exception as e:
                logger.debug(f"News fetch error for {symbol}: {e}")
                continue
            
        # Sort by time, latest first
        all_news.sort(key=lambda x: x['updated_at'], reverse=True)
        return all_news[:30] # Store up to 30 latest news items
    except Exception as e:
        logger.warning(f"Failed to fetch real news: {e}")
        return []

def fetch_live_data(symbols):
    if not symbols: return {}, {}
    COMMODITIES = {"BZ=F": "Brent Crude"}
    
    # Filter out Tata sub-tickers from the download list
    has_pv = "TATAMOTORS_PV.NS" in symbols
    has_cv = "TATAMOTORS_CV.NS" in symbols
    
    download_symbols = [s for s in symbols if s not in ["TATAMOTORS_PV.NS", "TATAMOTORS_CV.NS"]]
    if (has_pv or has_cv) and "TATAMOTORS.NS" not in download_symbols:
        download_symbols.append("TATAMOTORS.NS")

    all_symbols = list(INDICES.keys()) + list(COMMODITIES.keys()) + download_symbols
    try:
        data = yf.download(all_symbols, period="1d", interval="1m", group_by="ticker", threads=True, progress=False)
        updates, index_updates, commodity_updates = {}, {}, {}
        for s in all_symbols:
            try:
                hist = data[s].dropna() if len(all_symbols) > 1 else data.dropna()
                if hist.empty: continue
                price = float(hist['Close'].iloc[-1])
                prev = float(hist['Open'].iloc[0])
                change = price - prev
                pct = (change / prev) * 100 if prev else 0
                payload = {
                    "price": round(price, 2), "change": round(change, 2), "change_pct": round(pct, 2),
                    "open": round(prev, 2),
                    "high": round(float(hist['High'].max()), 2), "low": round(float(hist['Low'].min()), 2),
                    "volume": int(hist['Volume'].iloc[-1]), "updated_at": int(time.time() * 1000)
                }
                safe_key = s.replace("^", "").replace(".", "_").replace("=", "_")
                if s in INDICES: 
                    payload["name"] = INDICES[s]
                    index_updates[safe_key] = payload
                elif s in COMMODITIES:
                    payload["name"] = COMMODITIES[s]
                    commodity_updates[safe_key] = payload
                else: 
                    updates[safe_key] = payload
            except: continue

        # Copy Tata Motors live prices to sub-tickers if requested
        tata_key = "TATAMOTORS_NS"
        if tata_key in updates:
            if has_pv:
                pv_payload = dict(updates[tata_key])
                updates["TATAMOTORS_PV_NS"] = pv_payload
            if has_cv:
                cv_payload = dict(updates[tata_key])
                updates["TATAMOTORS_CV_NS"] = cv_payload

        return updates, index_updates, commodity_updates
    except Exception as e:
        logger.error(f"Error fetching live data: {e}")
        return {}, {}, {}

def run_live_engine_loop():
    logger.info("Live Engine Thread started.")
    rot_idx, news_timer = 0, 0
    while True:
        try:
            status, summary = get_market_status()
            db.reference("market_status").set({"phase": status, "summary": summary, "updated_at": int(time.time() * 1000)})
            
            chunk = NIFTY_ROTATION[rot_idx:rot_idx + 8]
            rot_idx = (rot_idx + 8) % len(NIFTY_ROTATION)
            active = list(set(NIFTY_CORE + chunk))
            
            # Dynamic User Portfolio Tickers
            user_tickers = []
            try:
                users_data = db.reference("users").get()
                if users_data:
                    for uid, data in users_data.items():
                        portfolio = data.get("portfolio", {})
                        for t_key, p_item in portfolio.items():
                            t = p_item.get("ticker")
                            if t and t not in active:
                                user_tickers.append(t)
            except: pass

            active = list(set(active + user_tickers))
            
            live_stocks, live_indices, live_commodities = fetch_live_data(active)
            if live_stocks: 
                db.reference("live_prices").update(live_stocks)
            if live_indices:
                db.reference("market_indices").set(live_indices)
                nifty_pct = live_indices.get("NSEI", {}).get("change_pct", 0)
                sentiment = "Bullish" if nifty_pct > 0.5 else "Bearish" if nifty_pct < -0.5 else "Neutral"
                db.reference("market_sentiment").set({"index": "NIFTY 50", "sentiment": sentiment, "change_pct": nifty_pct})
            if live_commodities:
                db.reference("market_intelligence/commodities").set(live_commodities)

            if news_timer <= 0:
                news = generate_ai_news(live_stocks)
                if news: 
                    db.reference("news_cache").set(news)
                    logger.info(f"News Cache Updated with {len(news)} items.")
                news_timer = 8 # Update news every ~2 minutes (8 * 15s)
            else: news_timer -= 1
            logger.info(f"Sync Cycle Complete | Market: {status} | Tickers: {len(active)}")
        except Exception as e:
            logger.error(f"Live Engine Loop Error: {e}")
        time.sleep(15)

app = Flask(__name__)
CORS(app)

@app.route('/health')
def health(): return jsonify({"status": "healthy"}), 200

@app.route('/chat', methods=['POST'])
def proxy_chat():
    try:
        data = request.json
        res = requests.post("https://api.groq.com/openai/v1/chat/completions", 
                            headers={"Authorization": f"Bearer {GROQ_API_KEY}"}, json=data, timeout=30)
        
        # Log response if error
        if res.status_code != 200:
            logger.error(f"Groq API Error: {res.status_code} - {res.text}")
            
        return jsonify(res.json()), res.status_code
    except Exception as e:
        logger.error(f"Chat Proxy Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    init_firebase()
    threading.Thread(target=run_ai_predictor_loop, daemon=True).start()
    threading.Thread(target=run_live_engine_loop, daemon=True).start()
    logger.info("STOCKSENSE PRO BACKEND ACTIVE ON PORT 5000")
    serve(app, host='0.0.0.0', port=5000, threads=6)
