from fastapi import FastAPI, Request
import httpx
from typing import Optional, List, Dict, Any
import uvicorn

app = FastAPI()

async def _search_researcher(
    name: str,
    email: Optional[str] = None,
    field_id: Optional[int] = None,
    specialty_ids: Optional[List[str]] = None
) -> Dict[str, Any]:
    payload = {
        "name": name,
        "email": email,
        "field_id": field_id,
        "specialty_ids": specialty_ids
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post("http://localhost:3002/api/search", json=payload)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        return {"error": f"API call failed: {str(e)}"}

async def _get_collaborators(
    session_id: str,
    profile_id: int
) -> Dict[str, Any]:
    payload = {"profileId": profile_id}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"http://localhost:3002/api/collaborators/{session_id}", json=payload)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        return {"error": f"API call failed: {str(e)}"}

@app.post("/search_researcher")
async def search_researcher_api(request: Request):
    try:
        data = await request.json()
        result = await _search_researcher(
            name=data.get("name"),
            email=data.get("email"),
            field_id=data.get("field_id"),
            specialty_ids=data.get("specialty_ids")
        )
        return result
    except Exception as e:
        return {"error": f"Request processing failed: {str(e)}"}

@app.post("/get_collaborators")
async def get_collaborators_api(request: Request):
    try:
        data = await request.json()
        result = await _get_collaborators(
            session_id=data.get("session_id"),
            profile_id=data.get("profile_id")
        )
        return result
    except Exception as e:
        return {"error": f"Request processing failed: {str(e)}"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001) 