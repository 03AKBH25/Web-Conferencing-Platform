# SyncMeet: Full-Stack Video Conferencing Platform

SyncMeet is a full-stack, browser-based, P2P WebRTC video conferencing application inspired by the Zoom web interface.

---

## 1. Project Architecture

The application splits responsibilities cleanly between backend data storage, real-time event distribution, and client-side peer media coordination.

```text
Next.js Frontend (React, Tailwind CSS, TypeScript)
       |
       +------ [HTTP REST APIs] -----> Django REST Framework (Python 3.11+, SQLite)
       |
       +------ [WebSockets (WS)] ----> Django Channels (Daphne ASGI Server)
                                            |
                                            v
                                     WebRTC Mesh (P2P Client browser-to-browser)
```

1. **REST APIs (Django REST Framework)**:
   * Handles persistent workspace data (User profiles, Scheduled meetings list, Recent history logs, Notifications, Chat message history).
2. **WebSockets (Django Channels & Daphne)**:
   * Handles real-time signaling (WebRTC ICE candidates, Session Description protocol offer/answers).
   * Manages live presence tracking (`participant_joined`, `participant_left`) and audio/video media states synchronization.
3. **WebRTC Mesh Connection**:
   * Outgoing/incoming camera, microphone, and screen share tracks bypass the server and stream directly between connected peers.

---

## 2. Main Visual & Functional Features (Phase 3)

* **Personalized Dashboard**: Displaying dynamic time-based greetings ("Good morning, Alex"), upcoming scheduled panels, past history tables, and interactive action buttons.
* **Quick Actions Grid**:
  * **New Meeting**: Triggers an instant POST endpoint to generate a room and navigate to lobby.
  * **Join Meeting**: Pasta-aware modal validating meeting join statuses.
  * **Schedule Meeting**: Generates a persistent scheduled session config card.
* **Meetings Management**: Filter tab categories (All, Upcoming, History), details inspect view, and invite clipboard copy utilities.
* **Monthly Planner Grid**: Calendar view highlighting meeting dates. Clicking an agenda card opens metadata details.
* **Workspace Directory**: Catalogs members and teammates inside the user instance.
* **Unread Notifications**: Header widget with live bell icon counters, showing alerts that can be read or cleared globally.
* **Profile & Custom Settings**: Custom switches for default mic/camera status and date formatting options persisting to localStorage.

---

## 3. Environment Variables Configuration

### Frontend Config (`frontend/.env`)
Create a `.env` file in the `frontend` folder containing:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

---

## 4. Setup and Installation

### Backend Setup (Port 8000)
1. **Navigate to directory**:
   ```bash
   cd backend
   ```
2. **Create & activate virtualenv**:
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\Activate.ps1
   # macOS/Linux:
   source venv/bin/activate
   ```
3. **Install python packages**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Migrate & seed database**:
   ```bash
   python manage.py migrate
   python manage.py seed_data
   ```
5. **Start server**:
   ```bash
   daphne -b 127.0.5.1 -p 8000 config.asgi:application
   ```

### Frontend Setup (Port 3000)
1. **Navigate to directory**:
   ```bash
   cd ../frontend
   ```
2. **Install Node packages**:
   ```bash
   npm install
   ```
3. **Start Next.js dev server**:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 5. Browser Permissions

SyncMeet is built on standard HTML5 media capturing interfaces. To successfully coordinate video conferencing:
* Select **Allow** when prompted for camera/microphone access.
* If blocked or denied, you can adjust permissions by clicking the padlock icon in the browser address bar.
* fallback layouts enable joining the meeting with camera or audio muted.
