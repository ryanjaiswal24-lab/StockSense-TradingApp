import json
import firebase_admin
from firebase_admin import credentials, db

DATABASE_URL = "https://stockscene-560d7-default-rtdb.asia-southeast1.firebasedatabase.app"
SERVICE_ACCOUNT_PATH = r"c:\predictor\backend\serviceAccountKey.json"

def main():
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
        
        # We don't have the user ID, but we can list all users
        users = db.reference("users").get()
        print(json.dumps(users, indent=2))
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
