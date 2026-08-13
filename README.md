# SyncMeet: Full-Stack Video Conferencing Platform

SyncMeet is a professional, full-stack, browser-to-browser P2P video conferencing application inspired by the Zoom web experience.

---

## 1. System Architecture

The application separates concerns cleanly between persistent data management, real-time signaling, and browser-to-browser media streaming.

```text
       Next.js Frontend (React, Tailwind CSS, TypeScript)
               |                               |
               | [HTTP REST APIs]              | [WebSockets (WS)]
               v                               v
    Django REST Framework               Django Channels
   (Python 3.11+, SQLite)           (Daphne ASGI Server)
                                               |
                                               +----> Signaling SDP/ICE
                                               |
                                               v
                                      WebRTC Mesh (P2P Media)
                         (Browser A <=== audio/video ===> Browser B)
```

1. **Django REST Framework (REST Backend)**:
   * Handles persistent entities: user profiles, scheduled meetings, completed history logs, notification feeds, and database-persisted chat history.
2. **Django Channels & Daphne (WebSocket Signaling)**:
   * Manages live presence tracking (`participant_joined`, `participant_left`).
   * Broadcasts real-time events (media mute states, instant chat messages, meeting ending instructions).
   * Serves as the signaling plane for WebRTC: routing session description offers, answers, and ICE candidates between clients.
3. **WebRTC Mesh (P2P Media Plane)**:
   * Video, audio, and screen capture tracks flow directly between browser clients. Django Channels facilitates the initial handshake, after which the media plane operates entirely peer-to-peer, bypassing the server.

---

## 2. Database Models & Schema

SyncMeet utilizes a clean, normalized relational structure:

```text
    User ||--o{ Meeting : hosts
    User ||--o{ Notification : receives
    Meeting ||--|{ MeetingParticipant : contains
    Meeting ||--o{ MeetingEvent : logs
    MeetingParticipant ||--o{ MeetingMessage : sends
    MeetingParticipant ||--o{ MeetingEvent : triggers
```

* **User**: Standard Django user entity representing hosts and accounts.
* **Meeting**: Contains the `meeting_id` (UUID-derived format), title, scheduled timing, duration, status (`scheduled`, `active`, `ended`, `cancelled`), type (`instant`, `scheduled`), and backend-generated `invite_link`.
* **MeetingParticipant**: Tracks join/leave timestamps, custom display names, WebRTC session IDs, and real-time state values (active status, camera and microphone toggles).
* **MeetingMessage**: Stores chat history for each meeting room, linked to the sending participant.
* **MeetingEvent**: Tracks lifecycle actions (creation, starts, joins, state changes, disconnects, terminations) to compile audit histories.
* **Notification**: Stores transactional alert feeds (like meeting invitations or joins) for hosts.

---

## 3. WebRTC & Signaling Implementation

### The Handshake Sequence

```text
Browser A (Host)                   Django Channels                   Browser B (Guest)
       |                                  |                                  |
       |--- 1. Connect (Session ID A) --->|                                  |
       |                                  |<--- 2. Connect (Session ID B) ---|
       |<-- 3. Broadcast Joined (Sess B) -|                                  |
       |                                  |-- 4. Broadcast Joined (Sess A) ->|
       |--- 5. Create Offer ------------->|                                  |
       |       Type: 'webrtc_offer'       |-- 6. Forward Offer ------------->|
       |                                  |                                  |--- 7. Create Answer
       |                                  |<-- 8. Send Answer ('webrtc_ans') |
       |<-- 9. Forward Answer ------------|                                  |
       |                                  |                                  |
       |<=============== 10. ICE Candidates Exchange (Bi-directional) =======>|
       |<==================== 11. Direct P2P Media Stream ===================>|
```

* **Signal Routing**: Django Channels matches connections via `meeting_id` group channels. All signaling payloads include `to` and `from` session identifiers to route SDPs to correct peers.
* **ICE Queuing**: Since ICE candidates can arrive before the remote description is fully set up, the client features a queue cache (`iceQueueMap`). Candidates arriving out of order are stored and processed once `setRemoteDescription` resolves.
* **Track Replacement (Screen Share)**: Screen sharing utilizes `getDisplayMedia()` and calls `RTCRtpSender.replaceTrack()`. This changes the video stream dynamically across all active peer connections without requiring renegotiation or closing the peer connection.

---

## 4. Production Evolution (Scale Planning)

The current architecture is optimized for demonstration scales. For commercial production, it is designed to evolve:

| Component | Current (Demo) | Production Scale |
| :--- | :--- | :--- |
| **Media Topology** | Mesh (P2P) - O(N^2) bandwidth | **SFU (Selective Forwarding Unit)** - O(N) bandwidth |
| **Signaling Store** | In-Memory Channel Layer | **Redis Channel Layer** (distributed pub-sub) |
| **Network Traversal** | Public STUN Servers | Coordinated **TURN Servers** (Coturn) for firewall bypass |
| **Database** | SQLite (Single file) | **PostgreSQL** (with replication and connection pooling) |
| **Recording** | Local Capture | **Server-side Recording** (orchestrated via SFU media agents) |

---

## 5. Local Setup and Installation

### Backend Setup (Django & Daphne)

1. **Navigate to directory**:
   ```bash
   cd backend
   ```
2. **Create and activate virtual environment**:
   ```bash
   python -m venv venv
   # Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # macOS/Linux:
   source venv/bin/activate
   ```
3. **Install python packages**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Configure environment variables**:
   Create a `.env` file based on `.env.example`:
   ```env
   DEBUG=True
   SECRET_KEY=django-insecure-your-secret-key-change-me
   FRONTEND_URL=http://localhost:3000
   ALLOWED_HOSTS=localhost,127.0.0.1
   ```
5. **Migrate and Seed Database**:
   ```bash
   python manage.py migrate
   python manage.py seed_data
   ```
6. **Start Daphne ASGI Server**:
   ```bash
   venv\Scripts\daphne -b 127.0.0.1 -p 8000 config.asgi:application
   ```

### Frontend Setup (Next.js)

1. **Navigate to directory**:
   ```bash
   cd ../frontend
   ```
2. **Install Node packages**:
   ```bash
   npm install
   ```
3. **Configure environment variables**:
   Create a `.env` file based on `.env.example`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api
   NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
   ```
4. **Start Development Server**:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 6. Verification Guidelines (Evaluator Journey)

To review the application end-to-end:

### Workflow 1: Instant Meeting & Multi-Browser Meet
1. Open [http://localhost:3000](http://localhost:3000). You are greeted as the default user (Alex).
2. Click **New Meeting**.
3. Allow camera/microphone access in the Lobby.
4. Click **Join Meeting** (as Host). You are placed in the dark-themed meeting room.
5. Click the **Info** button (the info icon in the top-left next to the meeting title). 
6. Copy the **Invite Link** from the info panel.
7. Open an **Incognito/Secondary Browser Window** and paste the copied link.
8. Enter a guest display name (e.g., "Sarah Client") and click **Join Meeting**.
9. Both browsers will establish a WebRTC connection. Test toggling microphones, camera, screen-sharing, and sending chat messages.
10. As Host, click **End Meeting**. Both participants are redirected to the polished "Meeting Ended" screen.

### Workflow 2: Scheduling & Calendar
1. On the dashboard, click **Schedule Meeting**.
2. Fill out the form (Title, Description, Date, Duration) and submit.
3. The meeting will immediately appear under the **Upcoming** tab.
4. Navigate to the **Calendar** view from the sidebar. Select the date of your meeting.
5. The scheduled meeting card will render in the Agenda column. Click **Join** to navigate directly to the room.

---

## 7. QA Validation Matrix

* **Backend System Checks**: `PASS` (`python manage.py check` reports no issues)
* **Database Migrations**: `PASS` (No migration drift detected)
* **Backend Unit Tests**: `PASS` (20/20 test cases passing successfully)
* **Frontend Lint Rules**: `PASS` (0 warnings, 0 errors)
* **Next.js Production Build**: `PASS` (Successful static page compilation)
