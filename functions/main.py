# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import https_fn
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app

# For cost control, you can set the maximum number of containers that can be
# running at the same time. This helps mitigate the impact of unexpected
# traffic spikes by instead downgrading performance. This limit is a per-function
# limit. You can override the limit for each function using the max_instances
# parameter in the decorator, e.g. @https_fn.on_request(max_instances=5).
set_global_options(max_instances=10)

initialize_app()


@https_fn.on_request()
def get_stock_predictions(req: https_fn.Request) -> https_fn.Response:
    """Cloud Function to fetch stock predictions from Firestore."""
    try:
        from firebase_admin import firestore
        db = firestore.client()
        docs = db.collection("predictions").stream()
        predictions = [doc.to_dict() for doc in docs]
        return https_fn.Response(
            {"status": "success", "predictions": predictions},
            status=200,
            headers={"Content-Type": "application/json"},
        )
    except Exception as e:
        return https_fn.Response(
            {"status": "error", "message": str(e)},
            status=500,
            headers={"Content-Type": "application/json"},
        )