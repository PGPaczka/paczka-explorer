"""
Serwer plików z galerią, uploadem z zatwierdzeniem admina, i pobieraniem folderów jako ZIP.
Backend API (JSON) + serwuje React frontend.
"""
import os, shutil, json, uuid, zipfile, urllib.parse, tempfile
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

load_dotenv(Path(__file__).parent / ".env")

app = FastAPI(title="Paczka INFA - File Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

FILES_ROOT = Path(os.getenv("FILES_ROOT", r"c:\Users\dommi\Downloads\Paczka\Paczki INFA - Uporządkowane"))
PENDING_DIR = Path(os.getenv("PENDING_DIR", str(Path(__file__).parent / "pending")))
PENDING_META = PENDING_DIR / "pending_meta.json"
INDEX_FILE = Path(os.getenv("INDEX_FILE", r"c:\Users\dommi\Downloads\Paczka\INDEKS.csv"))
INDEX_DIR_FILE = Path(os.getenv("INDEX_DIR_FILE", r"c:\Users\dommi\Downloads\Paczka\INDEKS_DIR.csv"))
PENDING_DIR.mkdir(parents=True, exist_ok=True)

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024
PORT = int(os.getenv("PORT", "8081"))
GITHUB_PR_URL = os.getenv("GITHUB_PR_URL", "https://github.com/dommilosz/Paczka-eti-pg/pulls")

PREVIEWABLE_TEXT = {'.txt','.py','.java','.c','.cpp','.cs','.js','.html','.css',
    '.h','.asm','.m','.sql','.xml','.json','.yml','.yaml','.sh','.bat',
    '.cfg','.ini','.log','.csv','.adb','.ads','.hs','.st','.pl','.pro','.ts','.rb','.php','.r','.kt','.swift','.go','.rs'}
PREVIEWABLE_IMAGE = {'.jpg','.jpeg','.png','.gif','.bmp','.webp','.svg'}
PREVIEWABLE_PDF = {'.pdf'}
PREVIEWABLE_OFFICE = {'.docx','.doc','.pptx','.ppt','.xlsx','.xls','.odt','.odp','.ods'}
PREVIEWABLE_MARKDOWN = {'.md'}

MAX_FILES_PER_UPLOAD = 10


# ============ HELPERS ============

def load_pending():
    if PENDING_META.exists():
        return json.loads(PENDING_META.read_text(encoding='utf-8'))
    return []

def save_pending(data):
    PENDING_META.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def format_size(b):
    if b < 1024: return f"{b} B"
    elif b < 1024*1024: return f"{b/1024:.1f} KB"
    else: return f"{b/(1024*1024):.1f} MB"

def get_icon(ext):
    ext = ext.lower()
    icons = {'.pdf':'📄','.jpg':'🖼️','.jpeg':'🖼️','.png':'🖼️','.gif':'🖼️','.docx':'📝','.doc':'📝',
             '.pptx':'📊','.ppt':'📊','.zip':'📦','.rar':'📦','.7z':'📦','.py':'💻','.java':'💻',
             '.c':'💻','.cpp':'💻','.cs':'💻','.js':'💻','.html':'💻','.css':'💻','.txt':'📋',
             '.md':'📋','.xlsx':'📊','.csv':'📊','.m':'💻','.asm':'💻'}
    return icons.get(ext, '📎')

def is_previewable(ext):
    return ext.lower() in PREVIEWABLE_TEXT | PREVIEWABLE_IMAGE | PREVIEWABLE_PDF | PREVIEWABLE_OFFICE | PREVIEWABLE_MARKDOWN

def get_preview_type(ext):
    ext = ext.lower()
    if ext in PREVIEWABLE_IMAGE: return "image"
    if ext in PREVIEWABLE_PDF: return "pdf"
    if ext in PREVIEWABLE_MARKDOWN: return "markdown"
    if ext in PREVIEWABLE_TEXT: return "text"
    if ext in PREVIEWABLE_OFFICE: return "office"
    return None

def safe_path(path):
    target = FILES_ROOT / path
    if not str(target.resolve()).startswith(str(FILES_ROOT.resolve())):
        raise HTTPException(403)
    return target


# ============ INDEX ============

_index_descriptions = {}

def _load_index():
    global _index_descriptions
    if _index_descriptions:
        return
    if INDEX_FILE.exists():
        for i, line in enumerate(INDEX_FILE.read_text(encoding='utf-8').splitlines()):
            if i < 2 or not line.strip():
                continue
            parts = line.split(';')
            if len(parts) >= 5:
                rel_path = parts[0].strip().replace('\\', '/')
                desc = parts[4].strip()
                if desc:
                    _index_descriptions[rel_path] = desc

def get_description(rel_path):
    _load_index()
    return _index_descriptions.get(rel_path, "")


def search_index(query):
    """Search the index CSV for files matching the query (recursive, all fields).
    
    Supports logical operators:
    - AND (or &): all conditions must match
    - OR (or |): at least one condition must match
    - NOT (or !): exclude results matching this term
    
    Example: ".png AND matematyka dyskretna"
             "kolokwium OR egzamin"
             "algebra NOT poprawka"
    """
    _load_index()
    if not INDEX_FILE.exists():
        return []

    # Parse query into conditions
    conditions = _parse_search_query(query)
    if not conditions:
        return []

    results = []
    lines = INDEX_FILE.read_text(encoding='utf-8').splitlines()

    for i, line in enumerate(lines):
        if i < 2 or not line.strip():
            continue
        parts = line.split(';')
        if len(parts) < 5:
            continue

        rel_path = parts[0].strip()
        semester = parts[1].strip()
        subject = parts[2].strip()
        size_str = parts[3].strip()
        desc = parts[4].strip()

        # Search in filename, path, semester, subject, description
        filename = rel_path.split('\\')[-1] if '\\' in rel_path else rel_path.split('/')[-1]
        searchable = f"{rel_path} {semester} {subject} {desc} {filename}".lower()

        if _matches_conditions(searchable, conditions):
            rel_normalized = rel_path.replace('\\', '/')
            ext = ('.' + filename.rsplit('.', 1)[-1]).lower() if '.' in filename else ''
            try:
                size = int(size_str)
            except ValueError:
                size = 0

            results.append({
                "name": filename,
                "rel": rel_normalized,
                "ext": ext,
                "size": size,
                "sizeFormatted": format_size(size),
                "icon": get_icon(ext),
                "previewable": is_previewable(ext),
                "previewType": get_preview_type(ext),
                "description": desc,
                "semester": semester,
                "subject": subject,
                "path": '/'.join(rel_normalized.split('/')[:-1]),
            })

    return results


import re as _re

def _parse_search_query(query):
    """Parse a search query with AND/OR/NOT operators.
    
    Returns a list of condition groups (OR-separated).
    Each group is a list of (negated: bool, term: str) tuples (AND-separated).
    
    Logic: groups are OR'd together, within each group terms are AND'd.
    """
    query = query.strip()
    if not query:
        return None

    # Split by OR (case-insensitive) or |
    or_groups = _re.split(r'\s+OR\s+|\s*\|\s*', query, flags=_re.IGNORECASE)

    parsed_groups = []
    for group in or_groups:
        group = group.strip()
        if not group:
            continue
        # Split by AND (case-insensitive) or &
        and_terms = _re.split(r'\s+AND\s+|\s*&\s*', group, flags=_re.IGNORECASE)
        parsed_terms = []
        for term in and_terms:
            term = term.strip()
            if not term:
                continue
            # Check for NOT prefix (case-insensitive) or !
            negated = False
            if _re.match(r'^NOT\s+', term, flags=_re.IGNORECASE):
                negated = True
                term = _re.sub(r'^NOT\s+', '', term, flags=_re.IGNORECASE).strip()
            elif term.startswith('!'):
                negated = True
                term = term[1:].strip()
            if term:
                parsed_terms.append((negated, term.lower()))
        if parsed_terms:
            parsed_groups.append(parsed_terms)

    return parsed_groups if parsed_groups else None


def _matches_conditions(searchable, conditions):
    """Check if searchable text matches the parsed conditions.
    
    conditions: list of OR-groups, each group is a list of (negated, term) AND-terms.
    Returns True if ANY group fully matches (OR logic between groups).
    A group matches if ALL its terms match (AND logic within group).
    A term matches if it's found in searchable (or NOT found if negated).
    """
    for group in conditions:
        group_matches = True
        for negated, term in group:
            found = term in searchable
            if negated:
                if found:
                    group_matches = False
                    break
            else:
                if not found:
                    group_matches = False
                    break
        if group_matches:
            return True
    return False


# ============ AUTH ============

import hashlib

def _hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def _check_admin(request: Request) -> bool:
    token = request.cookies.get("admin_token", "")
    return token == _hash_pw(ADMIN_PASSWORD)


# ============ API: BROWSE ============

@app.get("/api/browse/{path:path}")
@app.get("/api/browse")
async def api_browse(request: Request, path: str = ""):
    target = safe_path(path)
    if not target.exists():
        raise HTTPException(404, "Folder nie istnieje")

    dirs_list = []
    files_list = []

    if target.is_dir():
        for item in sorted(target.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
            if item.name.startswith('.'):
                continue
            rel = str(item.relative_to(FILES_ROOT)).replace('\\', '/')
            if item.is_dir():
                fc = sum(1 for _ in item.rglob('*') if _.is_file())
                dirs_list.append({"name": item.name, "rel": rel, "fileCount": fc})
            else:
                ext = item.suffix.lower()
                size = item.stat().st_size
                desc = get_description(rel)
                preview_type = get_preview_type(ext)
                files_list.append({
                    "name": item.name,
                    "rel": rel,
                    "ext": ext,
                    "size": size,
                    "sizeFormatted": format_size(size),
                    "icon": get_icon(ext),
                    "previewable": is_previewable(ext),
                    "previewType": preview_type,
                    "description": desc,
                })

    # Build breadcrumb
    parts = Path(path).parts if path else []
    breadcrumb = [{"name": "Główna", "path": ""}]
    for i, part in enumerate(parts):
        breadcrumb.append({"name": part, "path": "/".join(parts[:i+1])})

    is_admin = _check_admin(request)

    return {
        "path": path,
        "breadcrumb": breadcrumb,
        "dirs": dirs_list,
        "files": files_list,
        "isAdmin": is_admin,
        "githubPrUrl": GITHUB_PR_URL,
    }


# ============ API: SEARCH ============

@app.get("/api/search")
async def api_search(q: str = "", limit: int = 100):
    """Recursive file search using INDEKS.csv."""
    if not q or len(q) < 2:
        return {"results": [], "query": q, "total": 0}

    results = search_index(q)
    total = len(results)
    results = results[:limit]

    return {"results": results, "query": q, "total": total}


# ============ API: PENDING ============

@app.get("/api/pending/{path:path}")
@app.get("/api/pending")
async def api_pending(request: Request, path: str = ""):
    if not _check_admin(request):
        raise HTTPException(403)
    pending = load_pending()
    relevant = [g for g in pending if g.get("target_path", "") == path]
    return {"pending": relevant}


@app.get("/api/pending-all")
async def api_pending_all(request: Request):
    if not _check_admin(request):
        raise HTTPException(403)
    return {"pending": load_pending()}


# ============ API: AUTH ============

@app.post("/api/login")
async def api_login(request: Request):
    body = await request.json()
    password = body.get("password", "")
    if password == ADMIN_PASSWORD:
        response = JSONResponse({"success": True})
        response.set_cookie("admin_token", _hash_pw(ADMIN_PASSWORD), httponly=True, samesite="strict", max_age=86400)
        return response
    raise HTTPException(401, "Nieprawidłowe hasło")


@app.post("/api/logout")
async def api_logout():
    response = JSONResponse({"success": True})
    response.delete_cookie("admin_token")
    return response


@app.get("/api/auth-status")
async def api_auth_status(request: Request):
    return {"isAdmin": _check_admin(request)}


# ============ DOWNLOAD FILE ============

@app.get("/download/{path:path}")
async def download(path: str):
    target = safe_path(path)
    if not target.is_file():
        raise HTTPException(404)
    return FileResponse(target, filename=target.name)


# ============ DOWNLOAD FOLDER AS ZIP ============

# In-memory store for zip job progress
_zip_jobs = {}  # job_id -> {"status": "packing"|"done"|"error", "progress": 0-100, "tmp_path": str, "filename": str}

def _cleanup_old_jobs():
    """Remove jobs older than 10 minutes."""
    now = datetime.now()
    to_remove = []
    for jid, job in _zip_jobs.items():
        if (now - job.get("created", now)).total_seconds() > 600:
            if job.get("tmp_path") and os.path.exists(job["tmp_path"]):
                os.unlink(job["tmp_path"])
            to_remove.append(jid)
    for jid in to_remove:
        del _zip_jobs[jid]


def _build_zip_job(job_id, file_list, base_path, filename):
    """Build ZIP in background thread, updating progress."""
    import threading

    def worker():
        tmp_fd, tmp_path = tempfile.mkstemp(suffix='.zip')
        os.close(tmp_fd)
        _zip_jobs[job_id]["tmp_path"] = tmp_path
        total = len(file_list)
        try:
            with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for i, (full_path, arc_name) in enumerate(file_list):
                    zf.write(full_path, arc_name)
                    _zip_jobs[job_id]["progress"] = int((i + 1) / total * 100)
            _zip_jobs[job_id]["status"] = "done"
            _zip_jobs[job_id]["filename"] = filename
        except Exception as e:
            _zip_jobs[job_id]["status"] = "error"
            _zip_jobs[job_id]["error"] = str(e)
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    _zip_jobs[job_id] = {"status": "packing", "progress": 0, "tmp_path": None, "filename": filename, "created": datetime.now()}
    t = threading.Thread(target=worker, daemon=True)
    t.start()


@app.post("/api/prepare-zip-folder")
async def prepare_zip_folder(request: Request):
    """Start building a ZIP for a folder, returns job_id for progress tracking."""
    body = await request.json()
    path = body.get("path", "")
    target = safe_path(path)
    if not target.is_dir():
        raise HTTPException(404)

    _cleanup_old_jobs()

    # Collect file list
    file_list = []
    for fp in target.rglob('*'):
        if fp.is_file():
            file_list.append((str(fp), str(fp.relative_to(target))))

    if not file_list:
        raise HTTPException(400, "Folder jest pusty")

    job_id = str(uuid.uuid4())[:12]
    _build_zip_job(job_id, file_list, target, f"{target.name}.zip")
    return {"jobId": job_id, "totalFiles": len(file_list)}


@app.post("/api/prepare-zip-selected")
async def prepare_zip_selected(request: Request):
    """Start building a ZIP for selected files, returns job_id for progress tracking."""
    body = await request.json()
    files = body.get("files", [])
    if not files:
        raise HTTPException(400, "Brak plików")

    _cleanup_old_jobs()

    file_list = []
    for rel in files:
        target = safe_path(rel)
        if target.is_file():
            file_list.append((str(target), target.name))
        elif target.is_dir():
            for fp in target.rglob('*'):
                if fp.is_file():
                    file_list.append((str(fp), f"{target.name}/{fp.relative_to(target)}"))

    if not file_list:
        raise HTTPException(400, "Brak plików do spakowania")

    job_id = str(uuid.uuid4())[:12]
    _build_zip_job(job_id, file_list, None, "wybrane_pliki.zip")
    return {"jobId": job_id, "totalFiles": len(file_list)}


@app.get("/api/zip-progress/{job_id}")
async def zip_progress(job_id: str):
    """Check progress of a ZIP job."""
    job = _zip_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job nie istnieje")
    return {
        "status": job["status"],
        "progress": job["progress"],
        "filename": job.get("filename", ""),
        "error": job.get("error", ""),
    }


@app.get("/api/zip-download/{job_id}")
async def zip_download(job_id: str):
    """Download a completed ZIP job."""
    job = _zip_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job nie istnieje")
    if job["status"] != "done":
        raise HTTPException(400, "ZIP nie jest jeszcze gotowy")

    tmp_path = job["tmp_path"]
    filename = job["filename"]

    # Clean up job entry
    del _zip_jobs[job_id]

    if not tmp_path or not os.path.exists(tmp_path):
        raise HTTPException(404, "Plik nie istnieje")

    async def iterfile():
        with open(tmp_path, 'rb') as f:
            while chunk := f.read(64 * 1024):
                yield chunk
        os.unlink(tmp_path)

    file_size = os.path.getsize(tmp_path)
    return StreamingResponse(
        iterfile(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(file_size),
        }
    )


# Legacy direct download endpoints (for small folders / direct links)

@app.get("/download-folder/{path:path}")
async def download_folder(path: str):
    target = safe_path(path)
    if not target.is_dir():
        raise HTTPException(404)

    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.zip')
    os.close(tmp_fd)
    try:
        with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for fp in target.rglob('*'):
                if fp.is_file():
                    zf.write(fp, str(fp.relative_to(target)))
    except Exception:
        os.unlink(tmp_path)
        raise HTTPException(500, "Błąd tworzenia archiwum")

    async def iterfile():
        with open(tmp_path, 'rb') as f:
            while chunk := f.read(64 * 1024):
                yield chunk
        os.unlink(tmp_path)

    file_size = os.path.getsize(tmp_path)
    return StreamingResponse(
        iterfile(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{target.name}.zip"',
            "Content-Length": str(file_size),
        }
    )


# ============ DOWNLOAD SELECTED FILES AS ZIP (legacy direct) ============

@app.post("/api/download-selected")
async def download_selected(request: Request):
    body = await request.json()
    files = body.get("files", [])
    if not files:
        raise HTTPException(400, "Brak plików")

    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.zip')
    os.close(tmp_fd)
    try:
        with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for rel in files:
                target = safe_path(rel)
                if target.is_file():
                    zf.write(target, target.name)
                elif target.is_dir():
                    for fp in target.rglob('*'):
                        if fp.is_file():
                            zf.write(fp, f"{target.name}/{fp.relative_to(target)}")
    except Exception:
        os.unlink(tmp_path)
        raise HTTPException(500, "Błąd tworzenia archiwum")

    async def iterfile():
        with open(tmp_path, 'rb') as f:
            while chunk := f.read(64 * 1024):
                yield chunk
        os.unlink(tmp_path)

    file_size = os.path.getsize(tmp_path)
    return StreamingResponse(
        iterfile(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="wybrane_pliki.zip"',
            "Content-Length": str(file_size),
        }
    )


# ============ VIEW RAW ============

@app.get("/view/{path:path}")
async def view_raw(path: str):
    target = safe_path(path)
    if not target.is_file():
        raise HTTPException(404)
    ext = target.suffix.lower()
    mt = {'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
          '.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.bmp':'image/bmp',
          '.txt':'text/plain; charset=utf-8','.csv':'text/plain; charset=utf-8',
          '.json':'application/json','.xml':'text/xml',
          '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.doc':'application/msword','.ppt':'application/vnd.ms-powerpoint',
          '.xls':'application/vnd.ms-excel'}
    return FileResponse(target, media_type=mt.get(ext, 'application/octet-stream'),
                        headers={"Content-Disposition": "inline"})



# ============ INDEX CSV ============

@app.get("/indeks.csv")
async def indeks_csv():
    if not INDEX_FILE.exists():
        raise HTTPException(404)
    return FileResponse(INDEX_FILE, media_type="text/csv; charset=utf-8", filename="INDEKS.csv")


@app.get("/structure")
async def structure():
    """Serve directory structure as CSV."""
    if not INDEX_DIR_FILE.exists():
        raise HTTPException(404)
    return FileResponse(INDEX_DIR_FILE, media_type="text/csv; charset=utf-8", filename="INDEKS_DIR.csv")


# ============ CREATE FOLDER ============

@app.post("/api/create-folder")
async def create_folder(request: Request):
    body = await request.json()
    target_path = body.get("target_path", "")
    folder_name = body.get("folder_name", "").strip()

    if not folder_name:
        raise HTTPException(400, "Nazwa folderu nie może być pusta")
    name = folder_name.replace('/', '').replace('\\', '').replace('..', '')
    if not name:
        raise HTTPException(400, "Nieprawidłowa nazwa folderu")

    client_ip = request.client.host if request.client else "unknown"
    group_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()

    pending = load_pending()
    pending.append({
        "group_id": group_id,
        "type": "folder",
        "target_path": target_path,
        "folder_name": name,
        "uploader": "Anonim",
        "ip": client_ip,
        "uploaded_at": now,
        "files": []
    })
    save_pending(pending)
    return {"success": True, "message": "Folder wysłany do zatwierdzenia"}


# ============ UPLOAD ============

@app.post("/api/upload")
async def upload(request: Request, file: list[UploadFile] = File(...), target_path: str = Form(""), uploader: str = Form("")):
    if not file or len(file) == 0:
        raise HTTPException(400, "Brak plików")
    if len(file) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(400, f"Maksymalnie {MAX_FILES_PER_UPLOAD} plików na raz")

    client_ip = request.client.host if request.client else "unknown"
    uploader_name = uploader or "Anonim"
    group_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()

    pending = load_pending()
    uploaded_files = []

    for f in file:
        if not f.filename:
            continue
        content = await f.read()
        if len(content) > MAX_UPLOAD_SIZE:
            continue
        file_id = str(uuid.uuid4())[:8]
        safe_name = f.filename.replace('/', '_').replace('\\', '_')
        pending_path = PENDING_DIR / f"{file_id}_{safe_name}"
        with open(pending_path, 'wb') as out:
            out.write(content)
        uploaded_files.append({
            "file_id": file_id,
            "original_name": f.filename,
            "filename": safe_name,
            "size": len(content),
            "pending_file": str(pending_path)
        })

    if not uploaded_files:
        raise HTTPException(400, "Żaden plik nie został zaakceptowany (za duże?)")

    # Check if there's a recent group from same IP
    existing_group = None
    for item in pending:
        if (item.get("ip") == client_ip and
            item.get("uploader") == uploader_name and
            item.get("target_path") == target_path):
            try:
                item_time = datetime.fromisoformat(item["uploaded_at"])
                if (datetime.now() - item_time).total_seconds() < 600:
                    existing_group = item
                    break
            except:
                pass

    if existing_group:
        existing_group["files"].extend(uploaded_files)
        existing_group["uploaded_at"] = now
    else:
        pending.append({
            "group_id": group_id,
            "target_path": target_path,
            "uploader": uploader_name,
            "ip": client_ip,
            "uploaded_at": now,
            "files": uploaded_files
        })

    save_pending(pending)
    return {"success": True, "message": "Pliki wysłane do zatwierdzenia"}


# ============ ADMIN: DELETE FILE ============

@app.post("/api/admin/delete-file")
async def admin_delete_file(request: Request):
    if not _check_admin(request):
        raise HTTPException(403)
    body = await request.json()
    file_path = body.get("file_path", "")
    target = safe_path(file_path)
    if not target.is_file():
        raise HTTPException(404)
    target.unlink()
    return {"success": True}


@app.post("/api/admin/delete-folder")
async def admin_delete_folder(request: Request):
    if not _check_admin(request):
        raise HTTPException(403)
    body = await request.json()
    folder_path = body.get("folder_path", "")
    if not folder_path:
        raise HTTPException(400, "Nie można usunąć folderu głównego")
    target = safe_path(folder_path)
    if not target.is_dir():
        raise HTTPException(404)
    shutil.rmtree(str(target))
    return {"success": True}


# ============ ADMIN: RENAME ============

@app.post("/api/admin/rename")
async def admin_rename(request: Request):
    if not _check_admin(request):
        raise HTTPException(403)
    body = await request.json()
    old_path = body.get("path", "")
    new_name = body.get("new_name", "").strip()

    if not old_path or not new_name:
        raise HTTPException(400, "Brak ścieżki lub nowej nazwy")

    # Sanitize new name
    new_name = new_name.replace('/', '').replace('\\', '').replace('..', '')
    if not new_name:
        raise HTTPException(400, "Nieprawidłowa nazwa")

    target = safe_path(old_path)
    if not target.exists():
        raise HTTPException(404, "Plik/folder nie istnieje")

    new_target = target.parent / new_name
    if new_target.exists():
        raise HTTPException(409, "Element o takiej nazwie już istnieje")

    target.rename(new_target)
    return {"success": True, "new_path": str(new_target.relative_to(FILES_ROOT)).replace('\\', '/')}


# ============ ADMIN: VIEW PENDING FILE ============

@app.get("/admin/view/{file_id}")
async def admin_view_raw(request: Request, file_id: str):
    if not _check_admin(request):
        raise HTTPException(403)
    pending = load_pending()
    for group in pending:
        for f in group.get("files", []):
            if f["file_id"] == file_id:
                source = Path(f["pending_file"])
                if not source.exists():
                    raise HTTPException(404)
                ext = Path(f["original_name"]).suffix.lower()
                mt = {'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
                      '.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.bmp':'image/bmp',
                      '.txt':'text/plain','.csv':'text/plain'}
                return FileResponse(source, media_type=mt.get(ext, 'application/octet-stream'),
                                    headers={"Content-Disposition": "inline"})
    raise HTTPException(404)


# ============ ADMIN: APPROVE/REJECT ============

@app.post("/api/admin/approve")
async def approve(request: Request):
    if not _check_admin(request):
        raise HTTPException(403)
    body = await request.json()
    group_id = body.get("group_id", "")
    pending = load_pending()
    group = next((g for g in pending if g.get("group_id") == group_id), None)
    if not group:
        raise HTTPException(404)

    target_path = group.get("target_path", "")

    if group.get("type") == "folder":
        target_dir = safe_path(target_path) / group["folder_name"]
        target_dir.mkdir(parents=True, exist_ok=True)
    else:
        target_dir = FILES_ROOT / target_path
        target_dir.mkdir(parents=True, exist_ok=True)
        for f in group.get("files", []):
            source = Path(f["pending_file"])
            if source.exists():
                shutil.move(str(source), str(target_dir / f["original_name"]))

    save_pending([g for g in pending if g.get("group_id") != group_id])
    return {"success": True}


@app.post("/api/admin/reject")
async def reject(request: Request):
    if not _check_admin(request):
        raise HTTPException(403)
    body = await request.json()
    group_id = body.get("group_id", "")
    pending = load_pending()
    group = next((g for g in pending if g.get("group_id") == group_id), None)
    if not group:
        raise HTTPException(404)

    for f in group.get("files", []):
        source = Path(f["pending_file"])
        if source.exists():
            source.unlink()

    save_pending([g for g in pending if g.get("group_id") != group_id])
    return {"success": True}


@app.post("/api/admin/approve-file")
async def approve_file(request: Request):
    if not _check_admin(request):
        raise HTTPException(403)
    body = await request.json()
    group_id = body.get("group_id", "")
    file_id = body.get("file_id", "")
    pending = load_pending()
    group = next((g for g in pending if g.get("group_id") == group_id), None)
    if not group:
        raise HTTPException(404)

    target_dir = FILES_ROOT / group.get("target_path", "")
    target_dir.mkdir(parents=True, exist_ok=True)

    file_entry = next((f for f in group.get("files", []) if f["file_id"] == file_id), None)
    if not file_entry:
        raise HTTPException(404)

    source = Path(file_entry["pending_file"])
    if source.exists():
        shutil.move(str(source), str(target_dir / file_entry["original_name"]))

    group["files"] = [f for f in group["files"] if f["file_id"] != file_id]
    if not group["files"]:
        pending = [g for g in pending if g.get("group_id") != group_id]
    save_pending(pending)
    return {"success": True}


@app.post("/api/admin/reject-file")
async def reject_file(request: Request):
    if not _check_admin(request):
        raise HTTPException(403)
    body = await request.json()
    group_id = body.get("group_id", "")
    file_id = body.get("file_id", "")
    pending = load_pending()
    group = next((g for g in pending if g.get("group_id") == group_id), None)
    if not group:
        raise HTTPException(404)

    file_entry = next((f for f in group.get("files", []) if f["file_id"] == file_id), None)
    if not file_entry:
        raise HTTPException(404)

    source = Path(file_entry["pending_file"])
    if source.exists():
        source.unlink()

    group["files"] = [f for f in group["files"] if f["file_id"] != file_id]
    if not group["files"]:
        pending = [g for g in pending if g.get("group_id") != group_id]
    save_pending(pending)
    return {"success": True}


# ============ SERVE REACT FRONTEND ============

FRONTEND_BUILD = Path(__file__).parent / "frontend" / "dist"

if FRONTEND_BUILD.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_BUILD / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        """Serve React app for all non-API routes."""
        index = FRONTEND_BUILD / "index.html"
        if index.exists():
            return FileResponse(index)
        raise HTTPException(404)
else:
    @app.get("/")
    async def root():
        return {"message": "Frontend not built. Run 'npm run build' in frontend/ directory."}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
