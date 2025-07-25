#!/usr/bin/env python3
"""
HTTP API wrapper for Akademik YÖK MCP Server
"""

import asyncio
import json
import time
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx

app = FastAPI(title="Akademik YÖK API", version="1.0.0")

class SearchRequest(BaseModel):
    name: str
    email: Optional[str] = None
    field_id: Optional[int] = None
    specialty_ids: Optional[List[str]] = None
    profile_id: Optional[int] = None

class CollaboratorsRequest(BaseModel):
    session_id: str
    researcher_name: Optional[str] = None

def generate_session_id():
    """Generate a unique session ID"""
    import time
    import random
    import string
    return f"session_{int(time.time())}_{(''.join(random.choices(string.ascii_lowercase + string.digits, k=9)))}"

@app.post("/api/search")
async def api_search(request: SearchRequest):
    """Search for researchers using Python scraping scripts"""
    print(f"🔍 Searching for researcher: '{request.name}'")
    print(f"🔧 DEBUG: Request data - field_id: {request.field_id}, specialty_ids: {request.specialty_ids}", flush=True)
    print(f"🔧 DEBUG: Request data - field_id: {request.field_id}, specialty_ids: {request.specialty_ids}", flush=True)
    
    if not request.name or not request.name.strip():
        raise HTTPException(status_code=400, detail="İsim gereklidir")
    
    session_id = generate_session_id()
    
    # Setup paths
    scripts_dir = Path("/var/www/akademik-tinder/scripts")
    session_dir = Path("/var/www/akademik-tinder/public/collaborator-sessions") / session_id
    main_profile_path = session_dir / "main_profile.json"
    
    # Create session directory
    session_dir.mkdir(parents=True, exist_ok=True)
    
    # Prepare Python script arguments
    main_profile_script = scripts_dir / "scrape_main_profile.py"
    python_args = [
        "/var/www/akademik-tinder/venv/bin/python",
        str(main_profile_script),
        request.name.strip(),
        session_id
    ]
    
    # Add email if provided
    if request.email and request.email.strip():
        python_args.extend(['--email', request.email.strip()])
    
    # Add field and specialties if provided
    if request.field_id and request.specialty_ids:
        # Load fields data (assuming it exists)
        fields_path = Path("/var/www/akademik-tinder/public/fields.json")
        if fields_path.exists():
            try:
                with open(fields_path, 'r', encoding='utf-8') as f:
                    fields_data = json.load(f)
                
                field_obj = None
                if isinstance(fields_data, list):
                    field_obj = next((f for f in fields_data if f.get('id') == request.field_id), None)
                
                if field_obj:
                    field_name = field_obj.get('name', '')
                    print(f"🔧 DEBUG: Field found - {field_name}", flush=True)
                    if field_name:
                        python_args.extend(['--field', field_name])
                        
                        # Handle specialties
                        if "all" in request.specialty_ids:
                            specialty_names = [s.get('name', '') for s in field_obj.get('specialties', [])]
                        else:
                            specialty_names = [
                                s.get('name', '') for s in field_obj.get('specialties', [])
                                if s.get('id') in request.specialty_ids or str(s.get('id')) in request.specialty_ids
                            ]
                        
                        if specialty_names:
                            python_args.extend(['--specialties', ','.join(specialty_names)])
            except Exception as e:
                print(f"⚠️ Fields data load error: {e}")
    
    print(f"🔄 Starting scraping with args: {python_args}")
    
    # Start the Python script
    try:
        process = subprocess.Popen(
            python_args,
            cwd="/var/www/akademik-tinder",
            env={**os.environ, "PATH": "/var/www/akademik-tinder/venv/bin:" + os.environ.get("PATH", "")},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        print(f"✅ Started scraping process with PID: {process.pid}")
        
    except Exception as e:
        print(f"❌ Failed to start scraping: {e}")
        raise HTTPException(status_code=500, detail=f"Script başlatılamadı: {str(e)}")
    
    # Wait for main profile scraping to complete
    done_path = session_dir / "main_done.txt"
    max_wait_seconds = 120 if request.email else 60  # Email varsa 2 dakika, yoksa 1 dakika
    poll_interval = 0.5
    waited = 0
    
    print(f"⏳ Waiting for scraping to complete (max {max_wait_seconds}s)...")
    
    while waited < max_wait_seconds:
        if main_profile_path.exists() and done_path.exists():
            try:
                with open(main_profile_path, 'r', encoding='utf-8') as f:
                    main_profile_data = json.load(f)
                
                profiles = []
                if isinstance(main_profile_data, list):
                    profiles = main_profile_data
                elif isinstance(main_profile_data, dict) and 'profiles' in main_profile_data:
                    profiles = main_profile_data['profiles']
                
                print(f"✅ Found {len(profiles)} profiles")
                
                # If single profile found, automatically start collaborator scraping
                if len(profiles) == 1 and (not request.email or not request.email.strip()):
                    print("🤝 Single profile found, starting collaborator scraping...")
                    
                    selected_profile = profiles[0]
                    collab_script = scripts_dir / "scrape_collaborators.py"
                    collab_args = [
                        "/var/www/akademik-tinder/venv/bin/python",
                        str(collab_script),
                        selected_profile['name'],
                        session_id,
                        selected_profile['url']
                    ]
                    
                    # Start collaborator scraping
                    try:
                        collab_process = subprocess.Popen(
                            collab_args,
                            cwd="/var/www/akademik-tinder",
                            env={**os.environ, "PATH": "/var/www/akademik-tinder/venv/bin:" + os.environ.get("PATH", "")},
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL
                        )
                        print(f"✅ Started collaborator scraping with PID: {collab_process.pid}")
                    except Exception as e:
                        print(f"⚠️ Failed to start collaborator scraping: {e}")
                    
                    # Return immediately, collaborators scraping in background
                    return {
                        "success": True,
                        "sessionId": session_id,
                        "profiles": profiles,
                        "collaborators": [],  # Empty initially
                        "total_profiles": len(profiles),
                        "total_collaborators": 0
                    }
                
                # Multiple profiles or email search
                return {
                    "success": True,
                    "sessionId": session_id, 
                    "profiles": profiles,
                    "total_profiles": len(profiles)
                }
                
            except Exception as e:
                print(f"⚠️ Error reading main profile: {e}")
        
        await asyncio.sleep(poll_interval)
        waited += poll_interval
    
    # Timeout
    print(f"⏰ Scraping timed out after {waited}s")
    
    # Check if any profiles were found despite timeout
    if main_profile_path.exists():
        try:
            with open(main_profile_path, 'r', encoding='utf-8') as f:
                main_profile_data = json.load(f)
            
            profiles = []
            if isinstance(main_profile_data, list):
                profiles = main_profile_data
            elif isinstance(main_profile_data, dict) and 'profiles' in main_profile_data:
                profiles = main_profile_data['profiles']
            
            if profiles:
                return {
                    "success": True,
                    "sessionId": session_id,
                    "profiles": profiles,
                    "total_profiles": len(profiles),
                    "warning": "Scraping timed out but some profiles were found"
                }
        except Exception as e:
            print(f"⚠️ Error reading partial results: {e}")
    
    raise HTTPException(status_code=404, detail="Profil bulunamadı veya zaman aşımı")

@app.post("/api/collaborators/{session_id}")
async def api_collaborators(session_id: str, request: dict = None):
    """Get collaborators for a session or start collaborator scraping"""
    print(f"👥 Getting collaborators for session: {session_id}")
    print(f"🔧 Request data: {request}")
    
    session_dir = Path("/var/www/akademik-tinder/public/collaborator-sessions") / session_id
    collab_path = session_dir / "collaborators.json"
    done_path = session_dir / "collaborators_done.txt"
    
    # Check if collaborators already exist
    if collab_path.exists():
        try:
            with open(collab_path, 'r', encoding='utf-8') as f:
                collaborators = json.load(f)
            
            completed = done_path.exists()
            
            print(f"✅ Found existing {len(collaborators)} collaborators (completed: {completed})")
            
            return {
                "success": True,
                "sessionId": session_id,
                "collaborators": collaborators,
                "total_collaborators": len(collaborators),
                "completed": completed
            }
        except Exception as e:
            print(f"⚠️ Error reading existing collaborators: {e}")
    
    # If no collaborators exist, check if we need to start scraping
    main_profile_path = session_dir / "main_profile.json"
    if not main_profile_path.exists():
        raise HTTPException(status_code=404, detail="Session bulunamadı")
    
    # If profileId is provided, start collaborator scraping
    if request and "profileId" in request:
        try:
            with open(main_profile_path, 'r', encoding='utf-8') as f:
                profiles = json.load(f)
            
            # Find selected profile
            profile_id = request["profileId"]
            selected_profile = None
            
            for profile in profiles:
                if profile.get("id") == profile_id:
                    selected_profile = profile
                    break
            
            if not selected_profile:
                raise HTTPException(status_code=404, detail="Seçilen profil bulunamadı")
            
            # Start collaborator scraping
            scripts_dir = Path("/var/www/akademik-tinder/scripts")
            collab_script = scripts_dir / "scrape_collaborators.py"
            collab_args = [
                "/var/www/akademik-tinder/venv/bin/python",
                str(collab_script),
                selected_profile['name'],
                session_id,
                selected_profile['url']
            ]
            
            print(f"🚀 Starting collaborator scraping for: {selected_profile['name']}")
            
            try:
                collab_process = subprocess.Popen(
                    collab_args,
                    cwd="/var/www/akademik-tinder",
                    env={**os.environ, "PATH": "/var/www/akademik-tinder/venv/bin:" + os.environ.get("PATH", "")},
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                print(f"✅ Started collaborator scraping with PID: {collab_process.pid}")
                
                # Scraping başlatıldı, şimdi tamamlanmasını bekle
                print(f"⏳ Waiting for collaborator scraping to complete...")
                wait_time = 0
                max_wait = 300  # 5 dakika maximum wait
                check_interval = 2  # 2 saniye aralıklarla kontrol
                
                while wait_time < max_wait:
                    if (session_dir / "collaborators_done.txt").exists():
                        print(f"✅ Collaborator scraping completed after {wait_time} seconds")
                        break
                    
                    await asyncio.sleep(check_interval)
                    wait_time += check_interval
                    
                    if wait_time % 10 == 0:  # Her 10 saniyede log
                        print(f"⏳ Still waiting for collaborators... {wait_time}s elapsed")
                
                if not (session_dir / "collaborators_done.txt").exists():
                    print(f"⚠️ Collaborator scraping timeout after {max_wait} seconds")
                    raise HTTPException(
                        status_code=408, 
                        detail=f"Collaborator scraping zaman aşımı. {max_wait} saniye sonra tamamlanmadı."
                    )
                
                # Read final collaborators
                final_collaborators = []
                if collab_path.exists():
                    try:
                        with open(collab_path, 'r', encoding='utf-8') as f:
                            final_collaborators = json.load(f)
                    except Exception as e:
                        print(f"⚠️ Error reading final collaborators: {e}")
                        final_collaborators = []
                
                print(f"✅ Returning {len(final_collaborators)} collaborators")
                
                return {
                    "success": True,
                    "sessionId": session_id,
                    "message": f"Collaborator scraping tamamlandı! {len(final_collaborators)} işbirlikçi bulundu.",
                    "profile": selected_profile,
                    "collaborators": final_collaborators,
                    "total_collaborators": len(final_collaborators),
                    "completed": True,
                    "scraping_started": True
                }
                
            except Exception as e:
                print(f"⚠️ Failed to start collaborator scraping: {e}")
                raise HTTPException(status_code=500, detail=f"Collaborator scraping başlatılamadı: {e}")
                
        except Exception as e:
            print(f"⚠️ Error processing profile selection: {e}")
            raise HTTPException(status_code=500, detail=f"Profil seçimi işlenirken hata: {e}")
    
    # For now, return empty collaborators (manual selection needed)
    return {
        "success": True,
        "sessionId": session_id,
        "collaborators": [],
        "total_collaborators": 0,
        "completed": False,
        "message": "Collaborator scraping için profil seçimi gerekli"
    }

@app.get("/api/collaborators/{session_id}")
async def get_collaborators_progress(session_id: str, wait: bool = True):
    """Get collaborators for a session - waits for completion if wait=True"""
    print(f"📊 Getting collaborators for session: {session_id} (wait={wait})")
    
    session_dir = Path("/var/www/akademik-tinder/public/collaborator-sessions") / session_id
    collab_path = session_dir / "collaborators.json"
    done_path = session_dir / "collaborators_done.txt"
    
    # Check if session exists
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Session bulunamadı")
    
    # If wait=True, wait for completion
    if wait:
        print(f"⏳ Waiting for collaborators_done.txt to be created...")
        wait_time = 0
        max_wait = 300  # 5 dakika maximum wait
        check_interval = 2  # 2 saniye aralıklarla kontrol
        
        while wait_time < max_wait:
            if done_path.exists():
                print(f"✅ collaborators_done.txt found after {wait_time} seconds")
                break
            
            await asyncio.sleep(check_interval)
            wait_time += check_interval
            
            if wait_time % 10 == 0:  # Her 10 saniyede log
                print(f"⏳ Still waiting... {wait_time}s elapsed")
        
        if not done_path.exists():
            print(f"⚠️ Timeout: collaborators_done.txt not found after {max_wait} seconds")
            raise HTTPException(
                status_code=408, 
                detail=f"Collaborator scraping zaman aşımı. {max_wait} saniye sonra tamamlanmadı."
            )
    
    # Check if scraping is completed
    completed = done_path.exists()
    
    if not completed and not wait:
        # Non-blocking mode, return current status
        return {
            "success": True,
            "sessionId": session_id,
            "collaborators": [],
            "total_collaborators": 0,
            "completed": False,
            "status": "🔄 Scraping devam ediyor...",
            "message": "Scraping henüz tamamlanmadı. wait=true ile çağırın veya daha sonra tekrar deneyin.",
            "timestamp": int(time.time())
        }
    
    # Read final collaborators
    collaborators = []
    if collab_path.exists():
        try:
            with open(collab_path, 'r', encoding='utf-8') as f:
                collaborators = json.load(f)
        except Exception as e:
            print(f"⚠️ Error reading final collaborators file: {e}")
            raise HTTPException(status_code=500, detail="Collaborators dosyası okunamadı")
    
    print(f"✅ Returning {len(collaborators)} final collaborators")
    
    return {
        "success": True,
        "sessionId": session_id,
        "collaborators": collaborators,
        "total_collaborators": len(collaborators),
        "completed": True,
        "status": f"✅ Scraping tamamlandı! {len(collaborators)} işbirlikçi bulundu.",
        "timestamp": int(time.time())
    }

@app.get("/")
async def root():
    return {
        "message": "Akademik YÖK API", 
        "status": "running",
        "version": "2.0.0",
        "features": [
            "Real YÖK scraping integration",
            "Session-based processing",
            "Automatic collaborator detection",
            "Retry logic and timeouts"
        ],
        "endpoints": [
            "/api/search",
            "/api/collaborators/{session_id}",
            "/health"
        ]
    }

@app.get("/health")
async def health():
    scripts_dir = Path("/var/www/akademik-tinder/scripts")
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "scripts_available": {
            "scrape_main_profile": (scripts_dir / "scrape_main_profile.py").exists(),
            "scrape_collaborators": (scripts_dir / "scrape_collaborators.py").exists()
        },
        "venv_path": "/var/www/akademik-tinder/venv/bin/python"
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Akademik YÖK HTTP API Server...")
    print("🌐 API will be available at: http://localhost:3002")
    print("🔧 Features:")
    print("    - Real YÖK scraping integration") 
    print("    - Session-based processing")
    print("    - Automatic collaborator detection")
    print("    - Retry logic and timeouts")
    uvicorn.run(app, host="0.0.0.0", port=3002) 