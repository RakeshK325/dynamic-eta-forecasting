from fastapi import FastAPI

app = FastAPI(
    title="Dynamic Train ETA Forecasting Engine",
    description="API for dynamic train running states, simulation control, and ETA predictions",
    version="0.1.0",
)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "dynamic-eta-forecasting",
        "version": "0.1.0",
    }
