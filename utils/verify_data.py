import json
import firebase_admin
from firebase_admin import credentials, db

DATABASE_URL = "https://stockscene-560d7-default-rtdb.asia-southeast1.firebasedatabase.app"
SERVICE_ACCOUNT_PATH = r"c:\predictor\predictor\serviceAccountKey.json"

def main():
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
        
        live_prices = db.reference("live_prices").get()
        if live_prices:
            print(f"Live prices found: {len(live_prices)} stocks")
            # Print first 2
            keys = list(live_prices.keys())[:2]
            for k in keys:
                print(f"{k}: {live_prices[k].get('price')}")
        else:
            print("No live prices found")
            
        ai_picks = db.reference("ai_picks").get()
        if ai_picks:
            print(f"AI picks found: {len(ai_picks)} stocks")
        else:
            print("No AI picks found")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
