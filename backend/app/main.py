from fastapi import FastAPI, status
from app.api.router import api_router
import uvicorn

app = FastAPI()
app.include_router(api_router, prefix="/api/v1")

@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {"message": "OK"}

if __name__ == '__main__':
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


