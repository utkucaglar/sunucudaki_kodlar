#!/usr/bin/env python3
"""
Akademik YÖK MCP Server

This MCP server provides tools to interact with the YÖK Academic API.
It allows searching for researchers and finding their collaborators.
"""

import asyncio
import json
import time
from typing import Any, Dict, List, Optional
import httpx
from fastmcp import FastMCP
from pydantic import BaseModel, Field


# Pydantic models for API responses
class Profile(BaseModel):
    id: int
    name: str
    institution: str
    email: str
    url: str


class SearchResponse(BaseModel):
    message: str
    request: Dict[str, Any]
    sessionId: str
    profiles: List[Profile]


class Collaborator(BaseModel):
    name: str
    institution: str
    email: str


class CollaboratorProfile(BaseModel):
    name: str
    institution: str


class CollaboratorsResponse(BaseModel):
    sessionId: str
    profile: CollaboratorProfile
    collaborators: List[Collaborator]


# Initialize MCP server
mcp = FastMCP("Akademik YÖK MCP")

# Base API URL
BASE_URL = "http://91.99.144.40:3002"

# Configuration for API calls
API_CONFIG = {
    "timeout": 120.0,  # Increased from 30 to 120 seconds
    "max_retries": 3,
    "retry_delay": 2.0,
    "collaborator_timeout": 180.0  # Even longer for collaborator requests
}


async def make_api_request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    payload: Dict[str, Any],
    timeout: float = None,
    retries: int = None
) -> Dict[str, Any]:
    """
    Make an API request with retry logic and proper error handling.
    """
    timeout = timeout or API_CONFIG["timeout"]
    retries = retries or API_CONFIG["max_retries"]
    
    for attempt in range(retries):
        try:
            print(f"🔄 API Request attempt {attempt + 1}/{retries} to {url}")
            print(f"📤 Payload: {json.dumps(payload, ensure_ascii=False)}")
            
            response = await client.request(
                method,
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=timeout
            )
            response.raise_for_status()
            
            result = response.json()
            print(f"✅ API Request successful on attempt {attempt + 1}")
            return {"success": True, "data": result}
            
        except httpx.TimeoutException as e:
            print(f"⏰ Timeout on attempt {attempt + 1}: {str(e)}")
            if attempt == retries - 1:
                return {
                    "success": False,
                    "error": f"Request timed out after {retries} attempts (timeout: {timeout}s)",
                    "error_type": "timeout"
                }
            await asyncio.sleep(API_CONFIG["retry_delay"])
            
        except httpx.HTTPError as e:
            print(f"❌ HTTP Error on attempt {attempt + 1}: {str(e)}")
            status_code = getattr(e.response, 'status_code', 'unknown') if hasattr(e, 'response') else 'unknown'
            if attempt == retries - 1:
                return {
                    "success": False,
                    "error": f"HTTP error after {retries} attempts: {str(e)}",
                    "status_code": status_code,
                    "error_type": "http"
                }
            await asyncio.sleep(API_CONFIG["retry_delay"])
            
        except Exception as e:
            print(f"💥 Unexpected error on attempt {attempt + 1}: {str(e)}")
            if attempt == retries - 1:
                return {
                    "success": False,
                    "error": f"Unexpected error after {retries} attempts: {str(e)}",
                    "error_type": "unexpected"
                }
            await asyncio.sleep(API_CONFIG["retry_delay"])


@mcp.tool()
async def search_researcher(
    name: str,
    email: Optional[str] = None,
    field_id: Optional[int] = None,
    specialty_ids: Optional[List[str]] = None,
    profile_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Search for researchers in the YÖK Academic database.
    
    Args:
        name: The name of the researcher to search for (required)
        email: Email address of the researcher (optional)
        field_id: Field ID for filtering (optional)
        specialty_ids: List of specialty IDs for filtering (optional)
        profile_id: Profile ID for filtering (optional)
    
    Returns:
        Dictionary containing search results with sessionId and profiles
    """
    
    print(f"🔍 Searching for researcher: '{name}'")
    
    # Prepare request payload
    payload = {"name": name}
    
    if email:
        payload["email"] = email
    if field_id:
        payload["fieldId"] = field_id
    if specialty_ids:
        payload["specialtyIds"] = specialty_ids
    if profile_id:
        payload["profileId"] = profile_id
    
    try:
        async with httpx.AsyncClient() as client:
            api_result = await make_api_request(
                client=client,
                method="POST",
                url=f"{BASE_URL}/api/search",
                payload=payload,
                timeout=API_CONFIG["timeout"]
            )
            
            if not api_result["success"]:
                return api_result
            
            result = api_result["data"]
            
            # Validate response structure
            search_response = SearchResponse(**result)
            
            print(f"✅ Search completed. Found {len(search_response.profiles)} profiles")
            
            return {
                "success": True,
                "message": search_response.message,
                "sessionId": search_response.sessionId,
                "profiles": [profile.dict() for profile in search_response.profiles],
                "total_profiles": len(search_response.profiles)
            }
            
    except Exception as e:
        print(f"💥 Search failed with unexpected error: {str(e)}")
        return {
            "success": False,
            "error": f"Search validation error: {str(e)}",
            "error_type": "validation"
        }


@mcp.tool()
async def get_collaborators(session_id: str, researcher_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Get collaborators for a researcher using their session ID from a previous search.
    
    Args:
        session_id: The session ID obtained from search_researcher tool
        researcher_name: Optional researcher name to include in payload
    
    Returns:
        Dictionary containing collaborator information
    """
    
    print(f"👥 Getting collaborators for session: {session_id}")
    
    try:
        async with httpx.AsyncClient() as client:
            # Fixed payload - include researcher name if available
            payload = {
                "name": researcher_name or "",
                "sessionId": session_id  # Include session ID in payload
            }
            
            api_result = await make_api_request(
                client=client,
                method="POST",
                url=f"{BASE_URL}/api/collaborators/{session_id}",
                payload=payload,
                timeout=API_CONFIG["collaborator_timeout"]  # Longer timeout for collaborators
            )
            
            if not api_result["success"]:
                return api_result
            
            result = api_result["data"]
            
            # Validate response structure
            collaborators_response = CollaboratorsResponse(**result)
            
            print(f"✅ Collaborators retrieved. Found {len(collaborators_response.collaborators)} collaborators")
            
            return {
                "success": True,
                "sessionId": collaborators_response.sessionId,
                "profile": collaborators_response.profile.dict(),
                "collaborators": [collab.dict() for collab in collaborators_response.collaborators],
                "total_collaborators": len(collaborators_response.collaborators)
            }
            
    except Exception as e:
        print(f"💥 Collaborators retrieval failed with unexpected error: {str(e)}")
        return {
            "success": False,
            "error": f"Collaborators validation error: {str(e)}",
            "error_type": "validation"
        }


@mcp.tool()
async def search_and_get_collaborators(
    name: str,
    email: Optional[str] = None,
    field_id: Optional[int] = None,
    specialty_ids: Optional[List[str]] = None,
    profile_id: Optional[int] = None,
    researcher_index: int = 0
) -> Dict[str, Any]:
    """
    Complete workflow: Search for a researcher and automatically get their collaborators.
    
    Args:
        name: The name of the researcher to search for (required)
        email: Email address of the researcher (optional)
        field_id: Field ID for filtering (optional)
        specialty_ids: List of specialty IDs for filtering (optional)
        profile_id: Profile ID for filtering (optional)
        researcher_index: Index of researcher to get collaborators for if multiple found (default: 0)
    
    Returns:
        Dictionary containing both search results and collaborator information
    """
    
    print(f"🚀 Starting complete workflow for: '{name}'")
    start_time = time.time()
    
    # Step 1: Search for researcher
    print("📝 Step 1: Searching for researcher...")
    search_result = await search_researcher(
        name=name,
        email=email,
        field_id=field_id,
        specialty_ids=specialty_ids,
        profile_id=profile_id
    )
    
    if not search_result.get("success", False):
        return {
            "success": False,
            "error": "Search failed",
            "search_result": search_result,
            "step_failed": "search"
        }
    
    # Check if any profiles were found
    profiles = search_result.get("profiles", [])
    if not profiles:
        return {
            "success": False,
            "error": "No researchers found with the given criteria",
            "search_result": search_result,
            "step_failed": "search"
        }
    
    # Validate researcher index
    if researcher_index >= len(profiles):
        return {
            "success": False,
            "error": f"Researcher index {researcher_index} out of range. Found {len(profiles)} researchers.",
            "search_result": search_result,
            "step_failed": "validation"
        }
    
    # Step 2: Get collaborators using session ID
    session_id = search_result.get("sessionId")
    selected_researcher = profiles[researcher_index]
    
    if not session_id:
        return {
            "success": False,
            "error": "No session ID returned from search",
            "search_result": search_result,
            "step_failed": "search"
        }
    
    print("👥 Step 2: Getting collaborators...")
    collaborators_result = await get_collaborators(
        session_id=session_id,
        researcher_name=selected_researcher["name"]
    )
    
    end_time = time.time()
    total_time = end_time - start_time
    
    print(f"✅ Workflow completed in {total_time:.2f} seconds")
    
    # Combine results
    return {
        "success": True,
        "workflow_completed": True,
        "execution_time": total_time,
        "search_result": search_result,
        "collaborators_result": collaborators_result,
        "selected_researcher": selected_researcher,
        "summary": {
            "researcher_name": selected_researcher["name"],
            "researcher_institution": selected_researcher["institution"],
            "total_collaborators": collaborators_result.get("total_collaborators", 0) if collaborators_result.get("success") else 0,
            "session_id": session_id,
            "execution_time_seconds": total_time
        }
    }


def main():
    """Main function to run the MCP server."""
    print("🚀 Starting Akademik YÖK MCP Server...")
    print("📚 Available tools:")
    print("  - search_researcher: Search for researchers")
    print("  - get_collaborators: Get collaborators using session ID")  
    print("  - search_and_get_collaborators: Complete workflow")
    print(f"\n🌐 API Base URL: {BASE_URL}")
    print(f"⚙️  Configuration:")
    print(f"    - Default timeout: {API_CONFIG['timeout']}s")
    print(f"    - Collaborator timeout: {API_CONFIG['collaborator_timeout']}s")
    print(f"    - Max retries: {API_CONFIG['max_retries']}")
    print(f"    - Retry delay: {API_CONFIG['retry_delay']}s")
    print("✅ Server ready for connections!")
    
    mcp.run()


if __name__ == "__main__":
    main() 