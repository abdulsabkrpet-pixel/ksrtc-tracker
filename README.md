# 🚍 KSRTC "Where is My Bus" - Real-Time Tracking System

A full-stack real-time transit tracking application built for **Karnataka State Road Transport Corporation (KSRTC)** corridors, featuring live map visualization, dynamic ETA calculations, route search, and dual telemetry modes (real GPS broadcasting & background highway simulation).

---

## 🌟 Key Features

1. **Live GPS Bus Tracking**:
   - High-frequency WebSocket streaming updates bus coordinates every 2.5 seconds.
   - Smooth coordinate animation & heading rotation (buses turn with the curves of the highway).
   - Color-coded badges for **Airavat Club Class (Volvo Multi-Axle)**, **Karnataka Sarige**, **Rajahamsa Executive**, and **FlyBus**.

2. **Expanded Karnataka Corridors (11 Active Routes)**:
   - **Bengaluru (Majestic) ↔ Mysuru Suburban** (145 km via Expressway / NH 275)
   - **Bengaluru (Majestic) ↔ Mangaluru (Bejai)** (350 km via Kunigal, Hassan, Sakleshpur & Shiradi Ghat / NH 75)
   - **Bengaluru (Majestic) ↔ Hubballi (Old Stand)** (412 km via Tumakuru, Chitradurga, Davanagere / NH 48)
   - **Bengaluru (Majestic) ↔ Belagavi (CBT)** (510 km via Dharwad & Kittur / NH 48)
   - **Mysuru Suburban ↔ Madikeri (Coorg)** (120 km via Hunsur & Kushalnagar / NH 275)
   - **Mysuru Suburban ↔ Shivamogga (Shimoga)** (245 km via K.R. Nagar, Hassan, Arsikere, Kadur, Bhadravati)
   - **Bengaluru (Majestic) ↔ Krishnarajpet (K.R. Pete)** (155 km via Ramanagara, Mandya & Melukote)
   - **Mysuru Suburban ↔ Hassan via Krishnarajpet** (118 km via Srirangapatna, Pandavapura, K.R. Pete & CR Patna)
   - **Krishnarajpet (K.R. Pete) ↔ Srinagara (Bengaluru South) via Nagamangala** (152 km via Nagamangala, Bellur Cross, Kunigal, Kengeri)
   - **Krishnarajpet (K.R. Pete) ↔ Bherya via Akkihebbalu** (28 km rural express feeder connecting Cauvery/Hemavathi belt)
   - **Shivamogga ↔ Mysuru via K.R. Pete** (258 km via Bhadravati, Tarikere, Kadur, Arsikere, CR Patna, K.R. Pete, Pandavapura)

3. **📲 Android App (PWA) & Offline Timetable Caching**:
   - **Installable Android App**: Add to Home Screen via Chrome / Brave with custom KSRTC icon and fullscreen standalone experience.
   - **Offline Timetable Caching**: Service Worker (`sw.js`) caches all schedules, routes, stops, and app shell locally using `CacheStorage`.
   - **Offline Detection**: Automatic fallback when internet is unavailable with an "⚡ Offline" indicator.
   - **Timetable Viewer**: Instant schedule lookup with departure/arrival times, platform numbers, frequencies, and ticket fares.

4. **🔔 Smart Proximity Alerts**:
   - Set an alarm for your specific boarding or alighting stop.
   - Choose alert radius: **1 km (~2 min)**, **3 km (~5 min)**, **5 km (~8 min)**, or **10 km (~15 min)**.
   - **Multi-channel alerts**:
     - 🎵 **Web Audio Transit Chime**: Realistic dual-tone station bell synthesized directly in-browser.
     - 📳 **Android Vibration API**: Haptic vibration alert patterns on mobile devices.
     - 📢 **System Push Notifications**: Native device alerts via Web Notifications API.
     - 📱 **Animated In-App Banner**: Drop-down alert with bus registration and live distance.
   - 1-click alarm setting: Click the 🔔 icon next to any stop in the route timeline!

5. **🪑 Live Seat Occupancy Status**:
   - Real-time seat availability indicator on each bus:
     - 🟢 **Seats Available** (e.g. 18 / 45 seats free)
     - 🟡 **Filling Fast** (e.g. 6 seats remaining)
     - 🔴 **Almost Full** (e.g. 2 sleeper berths remaining)

6. **👥 Passenger Crowdsourcing Mode ("Where Is My Train" Style)**:
   - Passengers inside a moving bus can tap **"📍 I'm on this bus (Broadcast My GPS)"**.
   - Streams live coordinates to refine tracking accuracy for other passengers.

7. **🌐 Bilingual Experience (ಕನ್ನಡ & English)**:
   - Header button to toggle between Kannada and English.
   - Localized route names, stop boards, and timetable schedules.

8. **🧑‍✈️ Driver & Conductor Telemetry Portal**:
   - Dedicated driver web interface (`/driver.html`).
   - Streams phone GPS coordinates (`navigator.geolocation.watchPosition`) into the tracking backend.

---

## 🚀 How to Run & Access

The server is currently running in the background on port **3000**.

### 📱 Open on Your Device Browser:
- **Passenger Live Map**: [http://localhost:3000](http://localhost:3000) (or `http://localhost:3000/index.html`)
- **Driver GPS Broadcast Portal**: [http://localhost:3000/driver.html](http://localhost:3000/driver.html)

### 💻 To restart the server anytime:
```bash
cd ~/ksrtc-tracker
npm start
```

---

## 📡 REST API & WebSocket Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Server status, active bus count, and client connections |
| `GET` | `/api/routes` | All configured highway corridors and waypoints |
| `GET` | `/api/stops` | All KSRTC bus stands and platforms |
| `GET` | `/api/buses` | Current snapshot of all active buses with ETAs |
| `POST` | `/api/telemetry` | Ingest live GPS coordinates from driver devices |
| `POST` | `/api/simulator/toggle` | Pause / resume background simulated traffic |
| `WS` | `/` | WebSocket real-time pub/sub streaming |
