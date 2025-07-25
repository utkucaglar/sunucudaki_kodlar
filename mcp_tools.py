from fastapi import FastAPI, Request
import httpx
from typing import Optional, List, Dict, Any

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
    async with httpx.AsyncClient() as client:
        resp = await client.post("http://91.99.144.40:3002/api/search", json=payload)
        resp.raise_for_status()
        return resp.json()

async def _get_collaborators(
    session_id: str,
    profile_id: int
) -> Dict[str, Any]:
    payload = {"profileId": profile_id}
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"http://91.99.144.40:3002/api/collaborators/{session_id}", json=payload)
        resp.raise_for_status()
        return resp.json()

@app.post("/search_researcher")
async def search_researcher_api(request: Request):
    data = await request.json()
    result = await _search_researcher(
        name=data.get("name"),
        email=data.get("email"),
        field_id=data.get("field_id"),
        specialty_ids=data.get("specialty_ids")
    )
    return result

@app.post("/get_collaborators")
async def get_collaborators_api(request: Request):
    data = await request.json()
    result = await _get_collaborators(
        session_id=data.get("session_id"),
        profile_id=data.get("profile_id")
    )
    return result 