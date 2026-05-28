"""
Serwer plików z galerią, podglądem w modalu z nawigacją prev/next,
uploadem z zatwierdzeniem admina, i pobieraniem folderów jako ZIP.
"""
import os, io, shutil, json, uuid, zipfile, urllib.parse
import html as html_mod
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

load_dotenv(Path(__file__).parent / ".env")

app = FastAPI(title="Paczka INFA - File Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

FILES_ROOT = Path(os.getenv("FILES_ROOT", r"c:\Users\dommi\Downloads\Paczka\Paczki INFA - Uporządkowane"))
PENDING_DIR = Path(os.getenv("PENDING_DIR", str(Path(__file__).parent / "pending")))
PENDING_META = PENDING_DIR / "pending_meta.json"
INDEX_FILE = Path(os.getenv("INDEX_FILE", r"c:\Users\dommi\Downloads\Paczka\INDEKS.csv"))
TEMPLATE_PATH = Path(__file__).parent / "browse_template.html"
PENDING_DIR.mkdir(parents=True, exist_ok=True)

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024
PORT = int(os.getenv("PORT", "8081"))
GITHUB_PR_URL = os.getenv("GITHUB_PR_URL", "https://github.com/dommilosz/Paczka-eti-pg/pulls")

PREVIEWABLE_TEXT = {'.txt','.md','.py','.java','.c','.cpp','.cs','.js','.html','.css',
    '.h','.asm','.m','.sql','.xml','.json','.yml','.yaml','.sh','.bat',
    '.cfg','.ini','.log','.csv','.adb','.ads','.hs','.st','.pl','.pro','.ts','.rb','.php','.r','.kt','.swift','.go','.rs'}
PREVIEWABLE_IMAGE = {'.jpg','.jpeg','.png','.gif','.bmp','.webp','.svg'}
PREVIEWABLE_PDF = {'.pdf'}

def load_pending():
    if PENDING_META.exists(): return json.loads(PENDING_META.read_text(encoding='utf-8'))
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
    return ext.lower() in PREVIEWABLE_TEXT | PREVIEWABLE_IMAGE | PREVIEWABLE_PDF
def safe_path(path):
    target = FILES_ROOT / path
    if not str(target.resolve()).startswith(str(FILES_ROOT.resolve())):
        raise HTTPException(403)
    return target


# ============ BROWSE ============

# Load index descriptions (cached)
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


@app.get("/browse/{path:path}", response_class=HTMLResponse)
@app.get("/browse", response_class=HTMLResponse)
async def browse(request: Request, path: str = ""):
    target = safe_path(path)
    if not target.exists():
        raise HTTPException(404, "Folder nie istnieje")

    dirs_list = []
    files_list = []
    previewable_files = []  # for JS modal navigation

    if target.is_dir():
        for item in sorted(target.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
            if item.name.startswith('.'):
                continue
            rel = str(item.relative_to(FILES_ROOT)).replace('\\', '/')
            if item.is_dir():
                fc = sum(1 for _ in item.rglob('*') if _.is_file())
                dirs_list.append({"name": item.name, "rel": rel, "info": f"{fc} plików"})
            else:
                ext = item.suffix.lower()
                size = item.stat().st_size
                pv = is_previewable(ext)
                desc = get_description(rel)
                files_list.append({"name": item.name, "rel": rel, "ext": ext,
                                   "info": format_size(size), "icon": get_icon(ext),
                                   "previewable": pv, "desc": desc})
                if pv:
                    previewable_files.append({
                        "name": item.name, "ext": ext,
                        "view": f"/view/{urllib.parse.quote(rel)}",
                        "dl": f"/download/{urllib.parse.quote(rel)}"
                    })

    # Build HTML from template
    parts = Path(path).parts if path else []
    bc_parts = [f'<a href="/browse">🏠 Główna</a>']
    for i, part in enumerate(parts):
        bc_parts.append(f'<a href="/browse/{urllib.parse.quote("/".join(parts[:i+1]))}">{part}</a>')
    bc_html = '<span> / </span>'.join(bc_parts)

    msg = '<div class="msg msg-success">✅ Plik wysłany do zatwierdzenia.</div>' if request.query_params.get("uploaded") == "1" else ""

    # Show pending items for admin
    is_admin = _check_admin(request)
    show_pending = is_admin and request.query_params.get("pending") == "true"
    pending_html = ""
    if show_pending:
        pending = load_pending()
        relevant = [g for g in pending if g.get("target_path", "") == path]
        if relevant:
            for group in relevant:
                gid = group.get("group_id", "?")
                if group.get("type") == "folder":
                    pending_html += f'''<li class="file-item pending-group">
<div class="pending-header"><span class="file-icon">📁</span><span class="file-name"><strong>{html_mod.escape(group["folder_name"])}</strong><span class="file-desc">Nowy folder — {group["uploader"]} ({group.get("ip","")})</span></span>
<span class="pending-actions">
<form method="post" action="/admin/approve" style="display:inline"><input type="hidden" name="group_id" value="{gid}"><button class="pending-btn approve">✅ Utwórz</button></form>
<form method="post" action="/admin/reject" style="display:inline"><input type="hidden" name="group_id" value="{gid}"><button class="pending-btn reject">❌</button></form>
</span></div></li>'''
                else:
                    files = group.get("files", [])
                    total = sum(f["size"] for f in files)
                    # Group header with collapse
                    pending_html += f'''<li class="file-item pending-group"><details open>
<summary class="pending-header"><span class="file-icon">📤</span><span class="file-name"><strong>{len(files)} plik(ów)</strong> od {html_mod.escape(group["uploader"])}<span class="file-desc">{group.get("ip","")} | {format_size(total)} | {group["uploaded_at"][:16]}</span></span>
<span class="pending-actions">
<form method="post" action="/admin/approve" style="display:inline"><input type="hidden" name="group_id" value="{gid}"><button class="pending-btn approve">✅ Wszystkie</button></form>
<form method="post" action="/admin/reject" style="display:inline"><input type="hidden" name="group_id" value="{gid}"><button class="pending-btn reject">❌ Wszystkie</button></form>
</span></summary>
<ul class="pending-files">'''
                    # Individual files - same layout as normal files
                    for f in files:
                        fid = f["file_id"]
                        ext = Path(f["original_name"]).suffix.lower()
                        icon = get_icon(ext)
                        pv = is_previewable(ext)
                        view_url = f'/admin/view/{fid}'
                        dl_url = f'/admin/view/{fid}'
                        name_escaped = html_mod.escape(f["original_name"])
                        size_str = format_size(f["size"])
                        if pv:
                            name_link = f'<a href="#" onclick="openPendingPreview(\'{view_url}\',\'{html_mod.escape(f["original_name"], quote=True)}\',\'{ext}\');return false;">{name_escaped}</a>'
                        else:
                            name_link = f'<a href="{dl_url}">{name_escaped}</a>'
                        pending_html += f'''<li class="file-item pending-file">
<span class="file-icon">{icon}</span>
<span class="file-name">{name_link}</span>
<span class="file-info">{size_str}</span>
<a href="{dl_url}" class="btn-sm" title="Pobierz">⬇</a>
<span class="pending-file-actions">
<form method="post" action="/admin/approve-file"><input type="hidden" name="group_id" value="{gid}"><input type="hidden" name="file_id" value="{fid}"><button class="pending-btn approve" title="Zatwierdź ten plik">✅</button></form>
<form method="post" action="/admin/reject-file"><input type="hidden" name="group_id" value="{gid}"><input type="hidden" name="file_id" value="{fid}"><button class="pending-btn reject" title="Odrzuć ten plik">❌</button></form>
</span>
</li>'''
                    pending_html += '</ul></details></li>'
        elif is_admin:
            pending_html += '<li class="file-item" style="background:#e8f5e9;justify-content:center;font-size:13px;color:#2e7d32;">✅ Brak oczekujących w tym folderze</li>'

    # Admin toolbar link
    admin_link = ""
    if is_admin:
        if show_pending:
            admin_link = f'<a href="/browse/{urllib.parse.quote(path)}" style="padding:4px 10px;background:#ff9800;color:white;border-radius:4px;font-size:12px;text-decoration:none;">Ukryj pending</a>'
        else:
            pending_count = len([g for g in load_pending() if g.get("target_path", "") == path])
            if pending_count > 0:
                admin_link = f'<a href="/browse/{urllib.parse.quote(path)}?pending=true" style="padding:4px 10px;background:#ff9800;color:white;border-radius:4px;font-size:12px;text-decoration:none;">⏳ Pending ({pending_count})</a>'

    toolbar = f'{admin_link} ' + (f'<a href="/download-folder/{urllib.parse.quote(path)}" class="btn-folder-dl">⬇ Pobierz cały folder (ZIP)</a>' if path else "")

    # Build items HTML
    items_html = ""
    preview_idx = 0
    for d in dirs_list:
        items_html += f'<li class="file-item"><input type="checkbox" class="file-cb" data-rel="{html_mod.escape(d["rel"], quote=True)}"><span class="file-icon">📁</span><span class="file-name"><a href="/browse/{urllib.parse.quote(d["rel"])}">{html_mod.escape(d["name"])}</a></span><span class="file-info">{d["info"]}</span><a href="/download-folder/{urllib.parse.quote(d["rel"])}" class="btn-sm" title="Pobierz ZIP">⬇</a></li>'

    for f in files_list:
        cb = f'<input type="checkbox" class="file-cb" data-rel="{html_mod.escape(f["rel"], quote=True)}">'
        desc_html = f'<span class="file-desc">{html_mod.escape(f["desc"])}</span>' if f["desc"] else ""
        delete_btn = f'<form method="post" action="/admin/delete-file" style="display:inline"><input type="hidden" name="file_path" value="{html_mod.escape(f["rel"], quote=True)}"><button class="btn-sm btn-del" title="Usuń" onclick="return confirm(\'Usunąć {html_mod.escape(f["name"], quote=True)}?\')">🗑</button></form>' if is_admin else ""
        if f["previewable"]:
            items_html += f'<li class="file-item">{cb}<span class="file-icon">{f["icon"]}</span><span class="file-name"><a href="#" onclick="openPreview({preview_idx});return false;">{html_mod.escape(f["name"])}</a>{desc_html}</span><span class="file-info">{f["info"]}</span><a href="/download/{urllib.parse.quote(f["rel"])}" class="btn-sm" title="Pobierz">⬇</a>{delete_btn}</li>'
            preview_idx += 1
        else:
            items_html += f'<li class="file-item">{cb}<span class="file-icon">{f["icon"]}</span><span class="file-name"><a href="/download/{urllib.parse.quote(f["rel"])}">{html_mod.escape(f["name"])}</a>{desc_html}</span><span class="file-info">{f["info"]}</span><a href="/download/{urllib.parse.quote(f["rel"])}" class="btn-sm" title="Pobierz">⬇</a>{delete_btn}</li>'

    if not dirs_list and not files_list:
        items_html = '<div class="empty">Folder jest pusty</div>'

    # All files JSON for checkbox download
    all_files_json = json.dumps([{"rel": f["rel"], "name": f["name"]} for f in files_list], ensure_ascii=False)

    # Load template and fill
    template = TEMPLATE_PATH.read_text(encoding='utf-8')
    html = template.replace("{{TITLE}}", path or "Główna")
    html = html.replace("{{BREADCRUMB}}", bc_html)
    html = html.replace("{{TOOLBAR}}", toolbar)
    html = html.replace("{{MSG}}", msg)
    # Inject pending items at the top of the file list
    if pending_html:
        items_html = pending_html + items_html
    html = html.replace("{{ITEMS}}", items_html)
    html = html.replace("{{PATH}}", path)
    html = html.replace("{{FILES_JSON}}", json.dumps(previewable_files, ensure_ascii=False))
    html = html.replace("{{ALL_FILES_JSON}}", all_files_json)

    # Stats
    total_size = sum(f.get("size", 0) for f in files_list) if files_list else 0
    stats = f"📁 {len(dirs_list)} folderów, 📄 {len(files_list)} plików"
    html = html.replace("{{STATS}}", stats)
    html = html.replace("{{GITHUB_PR_URL}}", GITHUB_PR_URL)

    return HTMLResponse(html)


# ============ INDEX CSV ============

@app.get("/indeks.csv")
async def indeks_csv():
    if not INDEX_FILE.exists(): raise HTTPException(404)
    return FileResponse(INDEX_FILE, media_type="text/csv; charset=utf-8", filename="INDEKS.csv")


# ============ DOWNLOAD FILE ============

@app.get("/download/{path:path}")
async def download(path: str):
    target = safe_path(path)
    if not target.is_file(): raise HTTPException(404)
    return FileResponse(target, filename=target.name)


# ============ DOWNLOAD FOLDER AS ZIP ============

@app.get("/download-folder/{path:path}")
async def download_folder(path: str):
    target = safe_path(path)
    if not target.is_dir(): raise HTTPException(404)
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for fp in target.rglob('*'):
            if fp.is_file():
                zf.write(fp, str(fp.relative_to(target)))
    zip_buffer.seek(0)
    return StreamingResponse(zip_buffer, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{target.name}.zip"'})


# ============ DOWNLOAD SELECTED FILES AS ZIP ============

@app.post("/download-selected")
async def download_selected(files: list[str] = Form(...)):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for rel in files:
            target = safe_path(rel)
            if target.is_file():
                zf.write(target, target.name)
            elif target.is_dir():
                for fp in target.rglob('*'):
                    if fp.is_file():
                        zf.write(fp, f"{target.name}/{fp.relative_to(target)}")
    zip_buffer.seek(0)
    return StreamingResponse(zip_buffer, media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="wybrane_pliki.zip"'})


# ============ VIEW RAW ============

@app.get("/view/{path:path}")
async def view_raw(path: str):
    target = safe_path(path)
    if not target.is_file(): raise HTTPException(404)
    ext = target.suffix.lower()
    mt = {'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
          '.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.bmp':'image/bmp',
          '.txt':'text/plain; charset=utf-8','.csv':'text/plain; charset=utf-8',
          '.json':'application/json','.xml':'text/xml'}
    return FileResponse(target, media_type=mt.get(ext, 'text/plain; charset=utf-8'),
                        headers={"Content-Disposition": "inline"})


# ============ CREATE FOLDER ============

@app.post("/create-folder")
async def create_folder(request: Request, target_path: str = Form(""), folder_name: str = Form("")):
    if not folder_name or not folder_name.strip():
        raise HTTPException(400, "Nazwa folderu nie może być pusta")
    name = folder_name.strip().replace('/', '').replace('\\', '').replace('..', '')
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
    return RedirectResponse(f"/browse/{target_path}?uploaded=1", status_code=303)


# ============ UPLOAD ============

MAX_FILES_PER_UPLOAD = 10

@app.post("/upload")
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
            continue  # skip too large files silently
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

    # Check if there's a recent group from same IP (within last 10 min)
    existing_group = None
    for item in pending:
        if (item.get("ip") == client_ip and
            item.get("uploader") == uploader_name and
            item.get("target_path") == target_path):
            # Check if within 10 minutes
            try:
                item_time = datetime.fromisoformat(item["uploaded_at"])
                if (datetime.now() - item_time).total_seconds() < 600:
                    existing_group = item
                    break
            except:
                pass

    if existing_group:
        # Append files to existing group
        existing_group["files"].extend(uploaded_files)
        existing_group["uploaded_at"] = now  # update timestamp
    else:
        # Create new group
        pending.append({
            "group_id": group_id,
            "target_path": target_path,
            "uploader": uploader_name,
            "ip": client_ip,
            "uploaded_at": now,
            "files": uploaded_files
        })

    save_pending(pending)
    return RedirectResponse(f"/browse/{target_path}?uploaded=1", status_code=303)


# ============ ADMIN DELETE FILE ============

@app.post("/admin/delete-file")
async def admin_delete_file(request: Request, file_path: str = Form(...)):
    if not _check_admin(request): raise HTTPException(403)
    target = safe_path(file_path)
    if not target.is_file(): raise HTTPException(404)
    target.unlink()
    # Redirect back
    parent_path = '/'.join(file_path.replace('\\', '/').split('/')[:-1])
    return RedirectResponse(f"/browse/{parent_path}", status_code=303)


# ============ ADMIN ============

import hashlib

def _hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def _check_admin(request: Request) -> bool:
    token = request.cookies.get("admin_token", "")
    return token == _hash_pw(ADMIN_PASSWORD)


@app.get("/admin/login", response_class=HTMLResponse)
async def admin_login_page(error: str = ""):
    err_html = '<p style="color:#c62828;margin-bottom:8px;">Nieprawidłowe hasło</p>' if error else ""
    return HTMLResponse(f'<html><head><meta charset="utf-8"><title>Admin</title><style>body{{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f5f5;}}form{{background:white;padding:30px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);min-width:280px;}}input{{padding:10px;margin:8px 0;width:100%;border:1px solid #ccc;border-radius:4px;}}button{{padding:10px 20px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;width:100%;}}</style></head><body><form method="post" action="/admin/login"><h3>🔒 Panel admina</h3>{err_html}<input type="password" name="password" placeholder="Hasło" autofocus><button>Zaloguj</button></form></body></html>')


@app.post("/admin/login")
async def admin_login(password: str = Form("")):
    if password == ADMIN_PASSWORD:
        response = RedirectResponse("/admin", status_code=303)
        response.set_cookie("admin_token", _hash_pw(ADMIN_PASSWORD), httponly=True, samesite="strict", max_age=86400)
        return response
    return RedirectResponse("/admin/login?error=1", status_code=303)


@app.get("/admin/logout")
async def admin_logout():
    response = RedirectResponse("/admin/login", status_code=303)
    response.delete_cookie("admin_token")
    return response


@app.get("/admin", response_class=HTMLResponse)
async def admin_panel(request: Request):
    if not _check_admin(request):
        return RedirectResponse("/admin/login", status_code=303)

    pending = load_pending()
    rows = ""
    for item in pending:
        group_id = item.get("group_id", "?")

        if item.get("type") == "folder":
            # Folder creation request
            rows += f'<div class="item" style="border-left-color:#1976d2;"><strong>📁 Nowy folder: <code>{html_mod.escape(item["folder_name"])}</code></strong><div class="info">📁 W: {item["target_path"] or "/"} | 🌐 {item.get("ip","")} | 📅 {item["uploaded_at"][:16]}</div><div class="act"><form method="post" action="/admin/approve" style="display:inline"><input type="hidden" name="group_id" value="{group_id}"><button class="btn ba">✅ Utwórz</button></form><form method="post" action="/admin/reject" style="display:inline"><input type="hidden" name="group_id" value="{group_id}"><button class="btn br">❌ Odrzuć</button></form></div></div>'
        else:
            # File upload group
            files = item.get("files", [])
            total_size = sum(f["size"] for f in files)
            file_count = len(files)
            file_list_html = "".join(f'<div style="font-size:12px;color:#555;margin:2px 0;">• {html_mod.escape(f["original_name"])} ({format_size(f["size"])})</div>' for f in files[:10])
            if file_count > 10:
                file_list_html += f'<div style="font-size:12px;color:#999;">...i {file_count-10} więcej</div>'

            preview_btn = ""
            for f in files:
                ext = Path(f["original_name"]).suffix.lower()
                if ext in PREVIEWABLE_IMAGE | PREVIEWABLE_PDF | PREVIEWABLE_TEXT:
                    preview_btn = f'<a href="#" class="btn bp" onclick="openPv(\'{f["file_id"]}\',\'{html_mod.escape(f["original_name"], quote=True)}\',\'{ext}\');return false;">👁 Podgląd</a>'
                    break

            rows += f'<div class="item"><strong>{file_count} plik(ów)</strong> od <em>{html_mod.escape(item["uploader"])}</em><div class="info">📁 {item["target_path"] or "/"} | 🌐 {item.get("ip","")} | 📅 {item["uploaded_at"][:16]} | 💾 {format_size(total_size)}</div>{file_list_html}<div class="act">{preview_btn}<form method="post" action="/admin/approve" style="display:inline"><input type="hidden" name="group_id" value="{group_id}"><button class="btn ba">✅ Zatwierdź wszystkie</button></form><form method="post" action="/admin/reject" style="display:inline"><input type="hidden" name="group_id" value="{group_id}"><button class="btn br">❌ Odrzuć wszystkie</button></form></div></div>'

    if not pending:
        rows = '<div style="text-align:center;padding:40px;color:#666;">Brak plików do zatwierdzenia 🎉</div>'

    return HTMLResponse(f'<html><head><meta charset="utf-8"><title>Admin</title><style>body{{font-family:sans-serif;padding:20px;background:#f8f9fa;}}h2{{margin-bottom:16px;}}.topbar{{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}}.logout{{color:#666;font-size:13px;}}.item{{background:white;padding:16px;margin-bottom:12px;border-radius:8px;border-left:4px solid #ff9800;}}.info{{font-size:13px;color:#666;margin:4px 0;}}.act{{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;}}.btn{{padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;text-decoration:none;display:inline-block;}}.ba{{background:#4caf50;color:white;}}.br{{background:#f44336;color:white;}}.bp{{background:#1976d2;color:white;}}.modal-overlay{{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:1000;justify-content:center;align-items:center;}}.modal-overlay.active{{display:flex;}}.modal{{background:white;border-radius:12px;width:92%;max-width:950px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);}}.modal-header{{display:flex;align-items:center;padding:10px 16px;border-bottom:1px solid #e0e0e0;gap:8px;}}.modal-header h3{{flex:1;font-size:15px;margin:0;}}.modal-close{{background:none;border:none;font-size:22px;cursor:pointer;color:#666;padding:2px 8px;}}.modal-close:hover{{color:#333;}}.modal-body{{flex:1;overflow:auto;padding:16px;min-height:200px;}}.modal-body iframe{{width:100%;height:72vh;border:none;}}.modal-body img{{max-width:100%;max-height:72vh;display:block;margin:0 auto;border-radius:4px;}}.modal-body pre{{background:#1e1e1e;color:#d4d4d4;padding:16px;border-radius:8px;overflow:auto;max-height:72vh;font-size:13px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;}}</style></head><body><div class="topbar"><h2>📋 Do zatwierdzenia ({len(pending)} grup)</h2><a href="/admin/logout" class="logout">Wyloguj</a></div>{rows}<div class="modal-overlay" id="pvModal"><div class="modal"><div class="modal-header"><h3 id="pvTitle"></h3><button class="modal-close" onclick="closePv()">✕</button></div><div class="modal-body" id="pvBody"></div></div></div><script>function openPv(id,name,ext){{document.getElementById("pvTitle").textContent=name;const body=document.getElementById("pvBody");const viewUrl="/admin/view/"+id;const imgExts=[".jpg",".jpeg",".png",".gif",".bmp",".webp",".svg"];if([".pdf"].includes(ext)){{body.innerHTML=\'<iframe src="\'+viewUrl+\'"></iframe>\';}}else if(imgExts.includes(ext)){{body.innerHTML=\'<img src="\'+viewUrl+\'">\';}}else{{fetch(viewUrl).then(r=>r.text()).then(text=>{{const pre=document.createElement("pre");pre.textContent=text.substring(0,50000);body.innerHTML="";body.appendChild(pre);}}).catch(()=>{{body.innerHTML="Brak podglądu";}});}}document.getElementById("pvModal").classList.add("active");}}function closePv(){{document.getElementById("pvModal").classList.remove("active");document.getElementById("pvBody").innerHTML="";}}document.getElementById("pvModal").addEventListener("click",function(e){{if(e.target===this)closePv();}});document.addEventListener("keydown",function(e){{if(e.key==="Escape")closePv();}});</script></body></html>')


@app.get("/admin/view/{file_id}")
async def admin_view_raw(request: Request, file_id: str):
    if not _check_admin(request): raise HTTPException(403)
    pending = load_pending()
    # Find file across all groups
    for group in pending:
        for f in group.get("files", []):
            if f["file_id"] == file_id:
                source = Path(f["pending_file"])
                if not source.exists(): raise HTTPException(404)
                ext = Path(f["original_name"]).suffix.lower()
                mt = {'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
                      '.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.bmp':'image/bmp',
                      '.txt':'text/plain','.csv':'text/plain'}
                return FileResponse(source, media_type=mt.get(ext, 'application/octet-stream'),
                                    headers={"Content-Disposition": "inline"})
    raise HTTPException(404)


@app.post("/admin/approve")
async def approve(request: Request, group_id: str = Form(...)):
    if not _check_admin(request): raise HTTPException(403)
    pending = load_pending()
    group = next((g for g in pending if g.get("group_id") == group_id), None)
    if not group: raise HTTPException(404)

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

    referer = request.headers.get("referer", "")
    if "/browse" in referer:
        return RedirectResponse(referer, status_code=303)
    return RedirectResponse("/admin", status_code=303)


@app.post("/admin/reject")
async def reject(request: Request, group_id: str = Form(...)):
    if not _check_admin(request): raise HTTPException(403)
    pending = load_pending()
    group = next((g for g in pending if g.get("group_id") == group_id), None)
    if not group: raise HTTPException(404)

    for f in group.get("files", []):
        source = Path(f["pending_file"])
        if source.exists():
            source.unlink()

    save_pending([g for g in pending if g.get("group_id") != group_id])

    referer = request.headers.get("referer", "")
    if "/browse" in referer:
        return RedirectResponse(referer, status_code=303)
    return RedirectResponse("/admin", status_code=303)


@app.post("/admin/approve-file")
async def approve_file(request: Request, group_id: str = Form(...), file_id: str = Form(...)):
    """Approve a single file from a group."""
    if not _check_admin(request): raise HTTPException(403)
    pending = load_pending()
    group = next((g for g in pending if g.get("group_id") == group_id), None)
    if not group: raise HTTPException(404)

    target_dir = FILES_ROOT / group.get("target_path", "")
    target_dir.mkdir(parents=True, exist_ok=True)

    file_entry = next((f for f in group.get("files", []) if f["file_id"] == file_id), None)
    if not file_entry: raise HTTPException(404)

    source = Path(file_entry["pending_file"])
    if source.exists():
        shutil.move(str(source), str(target_dir / file_entry["original_name"]))

    # Remove file from group
    group["files"] = [f for f in group["files"] if f["file_id"] != file_id]
    # If group is now empty, remove it
    if not group["files"]:
        pending = [g for g in pending if g.get("group_id") != group_id]
    save_pending(pending)

    referer = request.headers.get("referer", "")
    if "/browse" in referer:
        return RedirectResponse(referer, status_code=303)
    return RedirectResponse("/admin", status_code=303)


@app.post("/admin/reject-file")
async def reject_file(request: Request, group_id: str = Form(...), file_id: str = Form(...)):
    """Reject a single file from a group."""
    if not _check_admin(request): raise HTTPException(403)
    pending = load_pending()
    group = next((g for g in pending if g.get("group_id") == group_id), None)
    if not group: raise HTTPException(404)

    file_entry = next((f for f in group.get("files", []) if f["file_id"] == file_id), None)
    if not file_entry: raise HTTPException(404)

    source = Path(file_entry["pending_file"])
    if source.exists():
        source.unlink()

    group["files"] = [f for f in group["files"] if f["file_id"] != file_id]
    if not group["files"]:
        pending = [g for g in pending if g.get("group_id") != group_id]
    save_pending(pending)

    referer = request.headers.get("referer", "")
    if "/browse" in referer:
        return RedirectResponse(referer, status_code=303)
    return RedirectResponse("/admin", status_code=303)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
