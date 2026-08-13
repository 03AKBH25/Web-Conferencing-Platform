# Zoom-Inspired Video Conferencing Backend (Phase 1)

This project contains the backend foundation for a production-quality, Zoom-inspired video conferencing web application. Built with Django and Django REST Framework, it serves as the REST API engine for Phase 1 and is pre-configured to easily adopt Django Channels and WebRTC in Phase 2.

---

## 1. Project Architecture

The application is designed API-first. A frontend (like Next.js) consumes REST APIs, while database persistence is handled via SQLite.

```mermaid
graph TD
    subgraph Client
        NextJS[Next.js Client]
    end

    subgraph Backend Engine (Phase 1)
        DRF[Django REST Framework] --> Auth[Accounts / Host Auth]
        DRF --> Meetings[Meetings Lifecycle]
        DRF --> Participants[Participant State]
        DRF --> Messages[In-meeting Chat]
        DRF --> Notifications[User Notifications]
    end

    subgraph Database
        SQLite[(SQLite DB)]
    end

    NextJS -- "REST API (HTTP)" --> DRF
    Auth & Meetings & Participants & Messages & Notifications --> SQLite
```

### Future Phase 2 Extension
In Phase 2, Django Channels will be introduced to handle real-time WebSockets.

```mermaid
graph TD
    NextJS[Next.js Client] -- "WebSockets (WS)" --> Channels[Django Channels (ASGI / Daphne)]
    Channels --> Signalling[WebRTC Signalling]
    Channels --> Presence[Real-time Presence]
    Channels --> Chat[Real-time Chat Events]
    Channels --> MediaState[Real-time Media States]
```

---

## 2. Setup and Installation

Follow these steps to run the backend locally:

### 1. Navigate to the backend directory
```bash
cd backend
```

### 2. Create a virtual environment
```bash
python -m venv venv
```

### 3. Activate the virtual environment
- **Windows (PowerShell):**
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
- **Windows (CMD):**
  ```cmd
  .\venv\Scripts\activate.bat
  ```
- **macOS / Linux:**
  ```bash
  source venv/bin/activate
  ```

### 4. Install dependencies
```bash
pip install -r requirements.txt
```

### 5. Create `.env` file
Verify or create a `.env` file in the `backend/` directory:
```env
DEBUG=True
SECRET_KEY=your-local-secret-key-change-me
FRONTEND_URL=http://localhost:3000
ALLOWED_HOSTS=localhost,127.0.0.1
```

### 6. Run Database Migrations
```bash
python manage.py migrate
```

### 7. Seed Database with Test Data
Populate the database with a default host user (Alex Johnson) and mock meetings (active, past, upcoming):
```bash
python manage.py seed_data
```
*Note: This creates the default host user `alex` with password `alex123`.*

### 8. Run the Development Server
```bash
python manage.py runserver
```
The API is now served at [http://127.0.0.1:8000/](http://127.0.0.1:8000/).

---

## 3. API Endpoints Reference

All requests must use `application/json` format.

To authenticate requests as the default host (Alex Johnson) for host-only actions, pass the following header:
`X-Demo-User: alex`

### Meetings API
| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/meetings/instant/` | Creates a new instant meeting | `{"title": "Instant Meeting", "description": ""}` |
| `POST` | `/api/meetings/` | Creates a scheduled meeting | `{"title": "Product Review", "description": "UX review", "scheduled_at": "ISO_DATE", "duration_minutes": 60}` |
| `GET` | `/api/meetings/` | List/Filter meetings | Query parameters: `?type=...`, `?status=...`, `?search=...`, `?upcoming=true`, `?recent=true` |
| `GET` | `/api/meetings/upcoming/` | Get upcoming meetings of host | None |
| `GET` | `/api/meetings/recent/` | Get the last 10 meetings | None |
| `GET` | `/api/meetings/search/` | Simple meeting search | Query parameter: `?q=search-term` |
| `GET` | `/api/meetings/<meeting_id>/` | Get meeting details | None |
| `GET` | `/api/meetings/<meeting_id>/validate/` | Validate if meeting is joinable | None |
| `POST` | `/api/meetings/<meeting_id>/join/` | Join a meeting | `{"display_name": "John Smith", "session_id": "unique-client-session-id"}` |
| `POST` | `/api/meetings/<meeting_id>/leave/` | Leave a meeting | `{"participant_id": <id>}` |
| `GET` | `/api/meetings/<meeting_id>/participants/` | Get active participants list | None |
| `PATCH` | `/api/meetings/<meeting_id>/participants/<participant_id>/` | Update participant media | `{"audio_enabled": true/false, "video_enabled": true/false}` |
| `DELETE`| `/api/meetings/<meeting_id>/participants/<participant_id>/` | Host removes participant | None (Requires `X-Demo-User` header) |
| `POST` | `/api/meetings/<meeting_id>/mute-all/` | Host mutes all active users | None (Requires `X-Demo-User` header) |
| `GET` | `/api/meetings/<meeting_id>/messages/` | Get in-meeting chat history | None |
| `POST` | `/api/meetings/<meeting_id>/messages/` | Post chat message | `{"participant_id": <id>, "message": "Text content"}` |

### Notifications API
| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications/` | Get user notifications & unread count | None |
| `PATCH` | `/api/notifications/<id>/read/` | Mark notification as read | None |
| `POST` | `/api/notifications/read-all/` | Mark all notifications as read | None |

### User accounts API
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/accounts/me/` | Get currently logged-in host profile details |

---

## 4. Run Automated Tests

To execute the unit tests:
```bash
python manage.py test
```
All tests check meeting creation, retrieval, validation, joining/leaving, host permissions, list queries, searches, and notifications.
