import json
import os
import firebase_admin
from firebase_admin import credentials, db
import yfinance as yf

DATABASE_URL = "https://stockscene-560d7-default-rtdb.asia-southeast1.firebasedatabase.app"
SERVICE_ACCOUNT_PATH = r"c:\predictor\predictor\serviceAccountKey.json"

def main():
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
        print("Firebase connected")
        
        # Test fetch
        ticker = yf.Ticker("RELIANCE.NS")
        print(f"Price: {ticker.history(period='1d')['Close'].iloc[-1]}")
        
        # Test write
        ref = db.reference("test_connection")
        ref.set({"status": "ok", "time": os.times()[4]})
        print("Test write successful")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
