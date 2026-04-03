# USB Data Integration

> Khi user cam USB vao LIVA Q3 Plus, OpenClaw tu dong scan du lieu va hien tab moi tren UI de su dung data.

## Muc tieu

- Detect USB cam/rut realtime
- Auto-mount + scan files
- Hien tab "USB Storage" tren UI
- User chon files -> AI su dung lam context

---

## Architecture

```
USB cam vao
    |
    v
udev/inotify detect (Linux kernel)
    |
    v
usb-monitor.ts (auto-mount via udisksctl)
    |
    v
usb-scanner.ts (recursive scan, categorize files)
    |
    v
WebSocket: usb.connected / usb.scan.complete
    |
    v
UI: Tab "USB" xuat hien voi file browser
```

### Backend

| File | Chuc nang |
|------|-----------|
| `server/services/usb-monitor.ts` | udev listener, auto-mount/unmount |
| `server/services/usb-scanner.ts` | File indexing, categorize, metadata |
| `server/routes/usb.ts` | API: list devices, list files, copy to workspace |

### Frontend

| File | Chuc nang |
|------|-----------|
| `src/pages/USB/index.tsx` | Main tab, device list |
| `src/pages/USB/FileBrowser.tsx` | Tree view file browser |
| `src/pages/USB/FilePreview.tsx` | Preview text/image/PDF |
| `src/stores/usb.ts` | Zustand state: devices, files, scanning status |

### WebSocket Events

| Event | Payload | Mo ta |
|-------|---------|-------|
| `usb.connected` | `{ deviceId, label, mountPath, totalSize }` | USB vua cam |
| `usb.disconnected` | `{ deviceId }` | USB vua rut |
| `usb.scan.progress` | `{ deviceId, scanned, total }` | Dang scan |
| `usb.scan.complete` | `{ deviceId, summary }` | Scan xong |

---

## Tinh nang chi tiet

### Phase 1: MVP

1. **USB Detection**
   - `udevadm monitor --subsystem-match=block` de detect USB
   - Auto-mount vao `/media/clawx/USB_LABEL/`
   - Detect rut USB -> unmount + cleanup

2. **File Scanner**
   - Recursive scan toan bo USB
   - Phan loai file:
     - Documents: PDF, DOCX, TXT, MD
     - Code: PY, JS, TS, SH, JSON, YAML
     - Data: CSV, XLSX, JSON (data files)
     - Media: JPG, PNG, MP4, MP3
   - Thu thap metadata: size, modified date, type
   - Summary: "15 documents, 3 datasets, 200 images"

3. **UI Tab**
   - Tab "USB" xuat hien khi co USB
   - Badge so luong devices
   - File browser dang tree view
   - Click file -> preview (text/image)
   - Button "Copy to Agent Workspace"

4. **AI Integration (basic)**
   - Chon files -> copy vao agent workspace
   - Agent tu dong nhan files moi trong workspace
   - Chat: "Phan tich file X trong USB"

### Phase 2: Smart Features

5. **Auto-categorize + Summary**
   - AI doc metadata -> phan loai thong minh
   - Tao summary: "USB chua bao cao tai chinh Q1-Q4, 3 datasets khach hang"
   - Suggest actions: "Co 3 CSV files, ban muon phan tich?"

6. **File Preview**
   - Text files: syntax highlighting
   - Images: thumbnail grid
   - PDF: embedded viewer (pdf.js)
   - CSV: table preview (first 100 rows)
   - Code: monaco editor read-only

7. **Search trong USB**
   - Full-text search trong text files
   - Filter theo type, size, date
   - Regex search

### Phase 3: Advanced

8. **RAG Integration**
   - Index text content -> embeddings
   - Vector store (local, e.g. Hnswlib)
   - Chat voi USB data: "Tim thong tin ve khach hang X trong cac file USB"

9. **Security**
   - ClamAV scan truoc khi mount (optional)
   - Whitelist file extensions
   - Max file size limit (default 100MB)
   - Sandbox cho executable files

10. **Sync/Backup**
    - Auto-backup USB -> `~/.clawx/usb-backup/`
    - Sync 2 chieu (optional)
    - Diff view khi co thay doi

11. **Multi-USB**
    - Nhieu USB cung luc -> sub-tabs
    - Label theo volume name
    - Merge search across devices

---

## API Endpoints

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| `GET` | `/api/usb/devices` | List USB devices dang cam |
| `GET` | `/api/usb/files/:deviceId` | List files trong USB |
| `GET` | `/api/usb/file/:deviceId/*path` | Read file content |
| `POST` | `/api/usb/copy` | Copy files vao agent workspace |
| `POST` | `/api/usb/eject/:deviceId` | Safe eject USB |

---

## Tech Stack

| Component | Tool | Ly do |
|-----------|------|-------|
| USB detect | `udevadm monitor` | Linux native, reliable |
| Auto-mount | `udisksctl mount` | No root needed |
| File scan | Node.js `fs.readdir` recursive | Fast, simple |
| Notify UI | WebSocket (da co) | Realtime |
| File preview | Built-in (text, image) + pdf.js | Nhe |
| Search | ripgrep (`rg`) | Nhanh |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| USB chua malware | Cao | ClamAV scan, whitelist extensions |
| USB qua lon (1TB) | Trung binh | Scan limit, pagination |
| USB rut giua luc scan | Trung binh | Graceful cleanup, cancel scan |
| Permission denied | Thap | udisksctl (no root), fallback sudo mount |
| Multiple USB cung luc | Thap | Device ID tracking |

---

## Estimated Effort

| Phase | Effort | Files moi |
|-------|--------|-----------|
| Phase 1 (MVP) | 2-3 ngay | ~8 files |
| Phase 2 (Smart) | 2-3 ngay | ~4 files |
| Phase 3 (Advanced) | 3-5 ngay | ~6 files |

---

## Navigation

- Tab "USB" chi hien khi co USB cam vao
- Vi tri: Sidebar, sau "Channels", truoc "Settings"
- Icon: `Usb` tu lucide-react
- Badge: so luong USB dang cam
- Toast notification khi USB cam/rut
