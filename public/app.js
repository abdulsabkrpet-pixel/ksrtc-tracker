// KSRTC Realtime Bus Tracking Client
let map;
let ws;
let routes = [];
let stops = [];
let busesMap = new Map();
let busMarkers = new Map();
let stopMarkers = [];
let routeLayers = new Map();
let selectedBusId = null;
let currentRouteFilter = 'ALL';
let simulatorEnabled = true;
let currentLanguage = 'EN'; // 'EN' or 'KN'

// Crowdsource GPS State
let crowdsourceWatchId = null;
let crowdsourceBusId = null;

// Translations
const I18N = {
  EN: {
    title: "ಕರ್ನಾಟಕ ಸಾರಿಗೆ • Live Tracker",
    subtitle: "Where Is My Bus • Real-time GPS",
    searchPlaceholder: "Search Bus (e.g. KA-09) or Stop...",
    allRoutes: "All Routes (ಎಲ್ಲಾ ಮಾರ್ಗಗಳು)",
    liveCount: "Buses Live",
    offline: "⚡ Offline",
    timetables: "📅 Timetables",
    install: "📲 Install",
    driver: "🧑‍✈️ Driver",
    nextStop: "Approaching Next Stop",
    liveSpeed: "Live Speed",
    direction: "Direction",
    depTime: "Dep. Time",
    fare: "Fare",
    stopsTimeline: "Route Stops & Live Arrival Times",
    setAlarm: "🔔 Set Proximity Alarm for My Stop",
    activeAlertFor: "Alert Active: ",
    cancel: "Cancel",
    crowdsourceStart: "📍 I'm on this bus (Broadcast My GPS)",
    crowdsourceStop: "🟢 Broadcasting My GPS (Live) • Tap to Stop",
    seatsFree: "Seats Available",
    almostFull: "Almost Full (Limited Seats)",
    fillingFast: "Seats Filling Fast"
  },
  KN: {
    title: "ಕರ್ನಾಟಕ ಸಾರಿಗೆ • ಲೈವ್ ಟ್ರ್ಯಾಕರ್",
    subtitle: "ನನ್ನ ಬಸ್ ಎಲ್ಲಿದೆ • ಲೈವ್ ಜಿಪಿಎಸ್",
    searchPlaceholder: "ಬಸ್ (ಉದಾ. KA-09) ಅಥವಾ ನಿಲ್ದಾಣ ಹುಡುಕಿ...",
    allRoutes: "ಎಲ್ಲಾ ಮಾರ್ಗಗಳು (All Routes)",
    liveCount: "ಬಸ್ಸುಗಳು ಲೈವ್",
    offline: "⚡ ಆಫ್‌ಲೈನ್",
    timetables: "📅 ವೇಳಾಪಟ್ಟಿ",
    install: "📲 ಇನ್‌ಸ್ಟಾಲ್",
    driver: "🧑‍✈️ ಚಾಲಕ",
    nextStop: "ಮುಂದಿನ ನಿಲ್ದಾಣ",
    liveSpeed: "ಲೈವ್ ವೇಗ",
    direction: "ದಿಕ್ಕು",
    depTime: "ಹೊರಡುವ ಸಮಯ",
    fare: "ದರ",
    stopsTimeline: "ನಿಲ್ದಾಣಗಳು ಮತ್ತು ಆಗಮನದ ಸಮಯ",
    setAlarm: "🔔 ಈ ನಿಲ್ದಾಣಕ್ಕೆ ಎಚ್ಚರಿಕೆ ಅಲಾರಂ ಹೊಂದಿಸಿ",
    activeAlertFor: "ಸಕ್ರಿಯ ಅಲಾರಂ: ",
    cancel: "ರದ್ದುಮಾಡಿ",
    crowdsourceStart: "📍 ನಾನು ಈ ಬಸ್ಸಿನಲ್ಲಿದ್ದೇನೆ (ಲೈವ್ GPS ಹಂಚಿಕೊಳ್ಳಿ)",
    crowdsourceStop: "🟢 ಲೈವ್ GPS ಪ್ರಸಾರವಾಗುತ್ತಿದೆ • ನಿಲ್ಲಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ",
    seatsFree: "ಆಸನಗಳು ಲಭ್ಯವಿದೆ",
    almostFull: "ಬಹುತೇಕ ಭರ್ತಿಯಾಗಿದೆ",
    fillingFast: "ಆಸನಗಳು ಬೇಗ ಭರ್ತಿಯಾಗುತ್ತಿವೆ"
  }
};

function toggleLanguage() {
  currentLanguage = currentLanguage === 'EN' ? 'KN' : 'EN';
  const t = I18N[currentLanguage];

  document.getElementById('lang-btn-label').textContent = currentLanguage === 'EN' ? 'ಕನ್ನಡ' : 'English';
  document.getElementById('bus-search-input').placeholder = t.searchPlaceholder;
  document.getElementById('btn-open-timetables').querySelector('span').textContent = t.timetables;
  
  // Re-render currently open bottom sheet if active
  if (selectedBusId && busesMap.has(selectedBusId)) {
    renderBusDetailSheet(busesMap.get(selectedBusId));
  }

  // Update visible bus count text
  updateBusesOnMap(Array.from(busesMap.values()));
}

function stopCrowdsourcing() {
  if (crowdsourceWatchId !== null) {
    navigator.geolocation.clearWatch(crowdsourceWatchId);
    crowdsourceWatchId = null;
    crowdsourceBusId = null;
  }
  if (selectedBusId && busesMap.has(selectedBusId)) {
    renderBusDetailSheet(busesMap.get(selectedBusId));
  }
}

// Proximity Alert State
let activeAlert = null; // { busId, stopId, stopName, thresholdKm, triggered }
let selectedThresholdKm = 3;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(ctx, freq, startTime, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playTransitChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // D5 (587.33 Hz) -> A5 (880.00 Hz) transit chime double-stroke
  playTone(ctx, 587.33, now, 0.35);
  playTone(ctx, 880.00, now + 0.22, 0.55);
  playTone(ctx, 587.33, now + 0.75, 0.35);
  playTone(ctx, 880.00, now + 0.97, 0.75);
}

function triggerProximityAlert(bus, stop) {
  // 1. Play transit bell sound
  playTransitChime();

  // 2. Vibrate phone on Android
  if (navigator.vibrate) {
    try {
      navigator.vibrate([300, 150, 300, 150, 500]);
    } catch (e) {
      console.log('Vibration not permitted');
    }
  }

  // 3. Show In-App dropdown Toast Banner
  const toast = document.getElementById('proximity-toast');
  const toastTitle = document.getElementById('toast-title');
  const toastDesc = document.getElementById('toast-desc');

  toastTitle.textContent = `🔔 ${bus.regNumber} is Approaching!`;
  toastDesc.textContent = `${bus.serviceName} is ${stop.distanceKm} km away from ${stop.name} (${stop.etaFormatted})!`;

  toast.classList.add('visible');

  // 4. System Push Notification if permission granted
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(`KSRTC Alert: ${bus.regNumber}`, {
        body: `${bus.serviceName} is arriving at ${stop.name} in ${stop.etaFormatted} (${stop.distanceKm} km)!`,
        icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚍</text></svg>'
      });
    } catch (e) {
      console.error('System notification error:', e);
    }
  }
}

function checkProximityAlerts(busesList) {
  if (!activeAlert || activeAlert.triggered) return;

  const bus = busesList.find(b => b.id === activeAlert.busId);
  if (!bus || !bus.stopTimeline) return;

  const targetStop = bus.stopTimeline.find(s => s.id === activeAlert.stopId);
  if (!targetStop) return;

  if (targetStop.status !== 'PASSED' && targetStop.distanceKm <= activeAlert.thresholdKm) {
    activeAlert.triggered = true;
    triggerProximityAlert(bus, targetStop);
    updateAlertUI();
  }
}

function updateAlertUI() {
  const setBox = document.getElementById('alert-set-box');
  const activeBox = document.getElementById('alert-active-box');
  const targetLabel = document.getElementById('active-alert-target');
  const threshLabel = document.getElementById('active-alert-threshold');

  if (activeAlert && !activeAlert.triggered && selectedBusId === activeAlert.busId) {
    setBox.style.display = 'none';
    activeBox.style.display = 'flex';
    targetLabel.textContent = `Alert Active: ${activeAlert.stopName}`;
    threshLabel.textContent = `Will notify when bus is within ${activeAlert.thresholdKm} km`;
  } else {
    setBox.style.display = 'block';
    activeBox.style.display = 'none';
  }
}

// Custom bus icon generator with rotation
function createBusIcon(bus) {
  let typeClass = 'sarige';
  if (bus.type.includes('AC Luxury')) typeClass = 'airavat';
  else if (bus.type.includes('Deluxe')) typeClass = 'rajahamsa';
  else if (bus.type.includes('FlyBus') || bus.serviceName.includes('FlyBus')) typeClass = 'flybus';
  else if (bus.type.includes('Sleeper')) typeClass = 'sleeper';

  const heading = bus.heading || 0;
  const shortNum = bus.regNumber ? bus.regNumber.split('-').slice(0, 2).join('-') : 'BUS';

  const html = `
    <div class="bus-marker-container">
      <div class="bus-marker-body ${typeClass}" style="transform: rotate(${heading}deg);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 6v6"/>
          <path d="M15 6v6"/>
          <path d="M2 12h19.6"/>
          <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.6-.5-1-1-1H3c-.6 0-1 .4-1 1 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"/>
          <circle cx="7" cy="18" r="2"/>
          <path d="M9 18h5"/>
          <circle cx="16" cy="18" r="2"/>
        </svg>
      </div>
      <div class="bus-label">${shortNum} • ${bus.speed || 0}k</div>
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'custom-bus-div-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
}

// Stop pin icon generator
function createStopIcon(isMajor) {
  const color = isMajor ? '#f59e0b' : '#94a3b8';
  const size = isMajor ? 12 : 8;
  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 6px rgba(0,0,0,0.6);
    "></div>
  `;
  return L.divIcon({
    html: html,
    className: 'stop-pin-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Transit Hub State
let activeHubStopId = null;
let activeHubTab = 'incoming'; // 'incoming' | 'outgoing'
let hubRadarCircle = null;

function findNearestStop(lat, lon) {
  if (!stops || stops.length === 0) return null;
  let closestStop = null;
  let minDistance = Infinity;

  stops.forEach(stop => {
    const dist = calculateDistanceKm(lat, lon, stop.coordinates[0], stop.coordinates[1]);
    if (dist < minDistance) {
      minDistance = dist;
      closestStop = stop;
    }
  });

  return closestStop;
}

function findStopBySearchTerm(term) {
  if (!term || !stops) return null;
  const raw = term.toLowerCase().trim();
  const norm = normalizeSearchTerm(raw);

  // Krishnarajpet variations
  const krpeteAliases = [
    'krpet', 'krpete', 'k.r.pet', 'k.r.pete', 'kr pet', 'kr pete',
    'krishnarajpet', 'krishnarajapet', 'krishnarajapete', 'krishnarajpete', 'krishnaraja',
    'ಕೃಷ್ಣರಾಜಪೇಟೆ', 'ಕೆಆರ್‌ಪೇಟೆ', 'ಕೆಆರ್ ಪೇಟೆ', 'ಕೆ.ಆರ್. ಪೇಟೆ'
  ];
  if (krpeteAliases.some(a => norm === normalizeSearchTerm(a) || norm.includes(normalizeSearchTerm(a)) || (normalizeSearchTerm(a).length >= 4 && normalizeSearchTerm(a).includes(norm)))) {
    return stops.find(s => s.id === 'stop-krpete') || null;
  }

  // Bherya variations
  const bheryaAliases = ['bherya', 'berya', 'bhirya', 'ಬೇರ್ಯ'];
  if (bheryaAliases.some(a => norm === normalizeSearchTerm(a) || norm.includes(normalizeSearchTerm(a)))) {
    return stops.find(s => s.id === 'stop-bherya') || null;
  }

  // Search each stop by name, kannadaName, aliases
  for (const s of stops) {
    if (s.name.toLowerCase().includes(raw)) return s;
    if (s.kannadaName && s.kannadaName.includes(raw)) return s;
    if (normalizeSearchTerm(s.name).includes(norm)) return s;
    if (s.aliases && s.aliases.some(a => normalizeSearchTerm(a).includes(norm) || norm.includes(normalizeSearchTerm(a)))) {
      return s;
    }
  }

  return null;
}

function openPlaceHub(stopId, autoPan = true) {
  activeHubStopId = stopId;
  const stop = stops.find(s => s.id === stopId);
  if (!stop) return;

  // Close bus detail sheet if open
  closeBusDetailSheet();

  document.getElementById('hub-place-name').textContent = currentLanguage === 'KN' && stop.kannadaName ? stop.kannadaName : stop.name;
  document.getElementById('hub-place-kannada').textContent = `${stop.kannadaName || ''} • Live Transit Hub (${stop.platform || ''})`;

  // Add animated radar circle around the touched/searched place
  if (hubRadarCircle) {
    map.removeLayer(hubRadarCircle);
  }
  hubRadarCircle = L.circle(stop.coordinates, {
    radius: 4000,
    color: '#f59e0b',
    fillColor: '#f59e0b',
    fillOpacity: 0.18,
    weight: 2,
    dashArray: '4, 8'
  }).addTo(map);

  if (autoPan) {
    map.setView(stop.coordinates, 11, { animate: true, duration: 0.8 });
  }

  refreshPlaceHub();
  document.getElementById('place-hub-sheet').classList.add('active');
}

function refreshPlaceHub() {
  if (!activeHubStopId) return;
  const stop = stops.find(s => s.id === activeHubStopId);
  if (!stop) return;

  const allBuses = Array.from(busesMap.values());
  const incomingBuses = [];
  const outgoingBuses = [];

  allBuses.forEach(bus => {
    if (!bus.stopTimeline) return;
    const stopEntry = bus.stopTimeline.find(s => s.id === activeHubStopId);
    if (!stopEntry) return;

    if (stopEntry.status === 'NEXT' || stopEntry.status === 'UPCOMING') {
      incomingBuses.push({
        bus,
        stopEntry,
        distanceKm: stopEntry.distanceKm,
        eta: stopEntry.etaFormatted
      });
    } else if (stopEntry.status === 'PASSED') {
      outgoingBuses.push({
        bus,
        stopEntry,
        distanceKm: stopEntry.distanceKm
      });
    }
  });

  // Sort incoming by distance ascending
  incomingBuses.sort((a, b) => a.distanceKm - b.distanceKm);
  // Sort outgoing by distance ascending
  outgoingBuses.sort((a, b) => a.distanceKm - b.distanceKm);

  document.getElementById('count-incoming').textContent = incomingBuses.length;
  document.getElementById('count-outgoing').textContent = outgoingBuses.length;

  renderHubBusCards(incomingBuses, outgoingBuses, stop);
}

function renderHubBusCards(incomingBuses, outgoingBuses, targetStop) {
  const container = document.getElementById('hub-buses-container');
  container.innerHTML = '';

  const isIncoming = activeHubTab === 'incoming';
  const list = isIncoming ? incomingBuses : outgoingBuses;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-hub-state">
        <div style="font-size: 28px; margin-bottom: 6px;">${isIncoming ? '🚍' : '🛣️'}</div>
        <strong>${isIncoming ? 'No live buses marching towards this stop right now.' : 'No buses currently departing this stop.'}</strong>
        <div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">Switch tabs above or check other routes.</div>
      </div>
    `;
    return;
  }

  list.forEach(item => {
    const bus = item.bus;
    const card = document.createElement('div');
    card.className = 'hub-bus-card';

    const route = routes.find(r => r.id === bus.routeId);
    const routeName = route ? (currentLanguage === 'KN' ? (route.kannadaName || route.name) : route.name) : (bus.serviceName);

    const etaBadge = isIncoming
      ? `<span class="hub-bus-eta-badge">⏱️ In ${item.eta} (${item.distanceKm} km)</span>`
      : `<span class="hub-bus-eta-badge outgoing">Departed (${item.distanceKm} km away)</span>`;

    card.innerHTML = `
      <div class="hub-bus-header">
        <div class="hub-bus-reg">
          <span>🚍 ${bus.regNumber}</span>
          <span class="bus-badge" style="background: ${bus.badgeColor || '#c0262d'}; font-size: 10px; padding: 2px 6px;">${bus.type}</span>
        </div>
        ${etaBadge}
      </div>
      <div class="hub-bus-route">
        ${routeName}
      </div>
      <div class="hub-bus-footer">
        <div>Speed: <strong style="color: white;">${bus.speed || 0} km/h</strong></div>
        <div style="color: #38bdf8; font-weight: 700;">${bus.fare || ''}</div>
        <div>${bus.availableSeats ? `🟢 ${bus.availableSeats} seats` : ''}</div>
      </div>
    `;

    card.addEventListener('click', () => {
      selectBus(bus.id);
    });

    container.appendChild(card);
  });
}

function closePlaceHub() {
  activeHubStopId = null;
  if (hubRadarCircle) {
    map.removeLayer(hubRadarCircle);
    hubRadarCircle = null;
  }
  document.getElementById('place-hub-sheet').classList.remove('active');
}

function initMap() {
  // Center roughly on Ramanagara / Mandya corridor
  map = L.map('map', {
    zoomControl: false
  }).setView([12.7237, 77.2811], 9);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // CartoDB Dark Matter or OpenStreetMap
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Touching anywhere on the map displays all buses marching towards and away from that place
  map.on('click', (e) => {
    const nearest = findNearestStop(e.latlng.lat, e.latlng.lng);
    if (nearest) {
      openPlaceHub(nearest.id, false);
    }
  });
}

function renderRoutesAndStops() {
  // Clear previous layers
  routeLayers.forEach(layer => map.removeLayer(layer));
  routeLayers.clear();
  stopMarkers.forEach(marker => map.removeLayer(marker));
  stopMarkers = [];

  // Render Routes as polylines
  const routeColors = ['#dc2626', '#2563eb', '#059669', '#d97706'];
  routes.forEach((route, idx) => {
    const color = routeColors[idx % routeColors.length];
    const polyline = L.polyline(route.waypoints, {
      color: color,
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    polyline.bindPopup(`
      <div style="font-size: 13px; font-weight: 600; color: #0f172a;">
        <strong>${route.name}</strong><br>
        <span style="color: #64748b; font-size: 11px;">${route.kannadaName || ''}</span><br>
        Distance: ${route.distanceKm} km &bull; Approx: ${route.approxDurationMin} mins
      </div>
    `);

    routeLayers.set(route.id, polyline);
  });

  // Render Bus Stops
  stops.forEach(stop => {
    const marker = L.marker([stop.coordinates[0], stop.coordinates[1]], {
      icon: createStopIcon(stop.majorHub)
    }).addTo(map);

    // Tapping on a stop immediately opens its Place Transit Hub
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      openPlaceHub(stop.id, false);
    });

    stopMarkers.push(marker);
  });
}

function normalizeSearchTerm(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[\.\s\-_]/g, '');
}

function busMatchesSearch(bus, rawSearch) {
  if (!rawSearch) return true;

  const raw = rawSearch.toLowerCase().trim();
  const norm = normalizeSearchTerm(raw);

  // Krishnarajpet (K.R. Pete) comprehensive aliases
  const krpeteAliases = [
    'krpet',
    'krpete',
    'k.r.pet',
    'k.r.pete',
    'kr pet',
    'kr pete',
    'k.r. pet',
    'k.r. pete',
    'krishnarajpet',
    'krishnarajapet',
    'krishnarajapete',
    'krishnarajpete',
    'krishnaraja',
    'krishnaraj',
    'ಕೃಷ್ಣರಾಜಪೇಟೆ',
    'ಕೆಆರ್‌ಪೇಟೆ',
    'ಕೆಆರ್ ಪೇಟೆ',
    'ಕೆ.ಆರ್. ಪೇಟೆ'
  ];

  const isKrishnarajpetSearch = krpeteAliases.some(alias => {
    const normAlias = normalizeSearchTerm(alias);
    return norm === normAlias || norm.includes(normAlias) || (normAlias.length >= 4 && normAlias.includes(norm));
  });

  if (isKrishnarajpetSearch) {
    // Return true for any bus passing through Krishnarajpet or operating on KRP corridors
    const passesThroughKRP = (bus.stopTimeline && bus.stopTimeline.some(s => s.id === 'stop-krpete')) ||
      (bus.routeId && (bus.routeId.includes('KRP') || bus.routeId === 'KA-BLR-KRP-07' || bus.routeId === 'KA-MYS-KRP-08' || bus.routeId === 'KA-KRP-SRN-09' || bus.routeId === 'KA-KRP-BHR-10' || bus.routeId === 'KA-SMG-MYS-KRP-11'));
    if (passesThroughKRP) return true;
  }

  // Bherya aliases (bherya, berya, bhirya, ಬೇರ್ಯ)
  const bheryaAliases = ['bherya', 'berya', 'bhirya', 'ಬೇರ್ಯ'];
  if (bheryaAliases.some(a => norm === normalizeSearchTerm(a) || norm.includes(normalizeSearchTerm(a)))) {
    if (bus.stopTimeline && bus.stopTimeline.some(s => s.id === 'stop-bherya')) return true;
    if (bus.routeId && bus.routeId.includes('BHR')) return true;
  }

  // Shivamogga / Shimoga aliases (shivamogga, shimoga, ಶಿವಮೊಗ್ಗ)
  const shimogaAliases = ['shivamogga', 'shimoga', 'ಶಿವಮೊಗ್ಗ', 'shimogga'];
  if (shimogaAliases.some(a => norm === normalizeSearchTerm(a) || norm.includes(normalizeSearchTerm(a)))) {
    if (bus.stopTimeline && bus.stopTimeline.some(s => s.id === 'stop-shivamogga')) return true;
    if (bus.routeId && bus.routeId.includes('SMG')) return true;
  }

  // Nagamangala aliases (nagamangala, nagmangala, ನಾಗಮಂಗಲ)
  const nagamangalaAliases = ['nagamangala', 'nagmangala', 'ನಾಗಮಂಗಲ'];
  if (nagamangalaAliases.some(a => norm === normalizeSearchTerm(a) || norm.includes(normalizeSearchTerm(a)))) {
    if (bus.stopTimeline && bus.stopTimeline.some(s => s.id === 'stop-nagamangala')) return true;
  }

  // Srinagara aliases (srinagara, srinagar, ಶ್ರೀನಗರ)
  const srinagaraAliases = ['srinagara', 'srinagar', 'ಶ್ರೀನಗರ'];
  if (srinagaraAliases.some(a => norm === normalizeSearchTerm(a) || norm.includes(normalizeSearchTerm(a)))) {
    if (bus.stopTimeline && bus.stopTimeline.some(s => s.id === 'stop-srinagara')) return true;
  }

  // Match Bus Registration Number (e.g. KA-09, KA-11, 8840)
  if (bus.regNumber && normalizeSearchTerm(bus.regNumber).includes(norm)) return true;

  // Match Service Name in English or Kannada
  if (bus.serviceName && bus.serviceName.toLowerCase().includes(raw)) return true;
  if (bus.kannadaServiceName && bus.kannadaServiceName.includes(raw)) return true;

  // Match Next Stop
  if (bus.nextStop) {
    if (bus.nextStop.name && bus.nextStop.name.toLowerCase().includes(raw)) return true;
    if (bus.nextStop.kannadaName && bus.nextStop.kannadaName.includes(raw)) return true;
    if (normalizeSearchTerm(bus.nextStop.name).includes(norm)) return true;
  }

  // Match ANY Stop along the bus timeline
  if (bus.stopTimeline && bus.stopTimeline.length > 0) {
    for (const stop of bus.stopTimeline) {
      if (stop.name && stop.name.toLowerCase().includes(raw)) return true;
      if (stop.kannadaName && stop.kannadaName.includes(raw)) return true;
      if (normalizeSearchTerm(stop.name).includes(norm)) return true;
    }
  }

  return false;
}

function updateBusesOnMap(busesList) {
  const searchTerm = document.getElementById('bus-search-input').value.trim();
  const busCountEl = document.getElementById('active-bus-count');

  let visibleCount = 0;

  busesList.forEach(bus => {
    busesMap.set(bus.id, bus);

    // Apply Route Filter & Search Filter
    const matchesRoute = (currentRouteFilter === 'ALL' || bus.routeId === currentRouteFilter);
    const matchesSearch = busMatchesSearch(bus, searchTerm);

    const isVisible = matchesRoute && matchesSearch;

    let marker = busMarkers.get(bus.id);

    if (isVisible) {
      visibleCount++;
      const latLng = [bus.currentLat, bus.currentLon];

      if (!marker) {
        marker = L.marker(latLng, {
          icon: createBusIcon(bus),
          zIndexOffset: 1000
        }).addTo(map);

        marker.on('click', () => {
          selectBus(bus.id);
        });

        busMarkers.set(bus.id, marker);
      } else {
        // Animate marker to new position smoothly
        marker.setLatLng(latLng);
        marker.setIcon(createBusIcon(bus));
      }
    } else {
      if (marker) {
        map.removeLayer(marker);
        busMarkers.delete(bus.id);
      }
    }
  });

  busCountEl.textContent = `${visibleCount} Buses Live`;

  // Evaluate any active proximity alert
  checkProximityAlerts(busesList);

  // If a bus is selected, update its drawer in real-time
  if (selectedBusId && busesMap.has(selectedBusId)) {
    renderBusDetailSheet(busesMap.get(selectedBusId));
  }

  // If a Place Transit Hub is active, refresh its live incoming and outgoing boards
  if (activeHubStopId) {
    refreshPlaceHub();
  }
}

function selectBus(busId) {
  selectedBusId = busId;
  const bus = busesMap.get(busId);
  if (!bus) return;

  // Close place hub drawer when inspecting an individual bus
  document.getElementById('place-hub-sheet').classList.remove('active');

  renderBusDetailSheet(bus);

  // Pan to bus
  map.panTo([bus.currentLat, bus.currentLon], {
    animate: true,
    duration: 0.8
  });
}

function renderBusDetailSheet(bus) {
  const sheet = document.getElementById('bus-detail-sheet');
  sheet.classList.add('active');

  document.getElementById('sheet-bus-number').textContent = bus.regNumber;
  document.getElementById('sheet-bus-service').textContent = currentLanguage === 'KN'
    ? (bus.kannadaServiceName || bus.serviceName)
    : bus.serviceName;
  
  const badge = document.getElementById('sheet-bus-badge');
  badge.textContent = bus.type;
  badge.style.background = bus.badgeColor || '#c0262d';

  // Live Occupancy Pill
  const occPill = document.getElementById('sheet-occupancy-pill');
  if (occPill) {
    let occClass = 'available';
    let occText = `🟢 ${bus.availableSeats || 15} Seats Available`;

    if (bus.occupancyStatus === 'ALMOST_FULL' || (bus.availableSeats !== undefined && bus.availableSeats <= 3)) {
      occClass = 'almost-full';
      occText = currentLanguage === 'KN'
        ? (bus.occupancyStatusKn || '🔴 ಬಹುತೇಕ ಭರ್ತಿಯಾಗಿದೆ')
        : `🔴 Almost Full (${bus.availableSeats} left)`;
    } else if (bus.occupancyStatus === 'FILLING_FAST' || (bus.availableSeats !== undefined && bus.availableSeats <= 8)) {
      occClass = 'filling';
      occText = currentLanguage === 'KN'
        ? (bus.occupancyStatusKn || `🟡 ${bus.availableSeats} ಆಸನ ಬಾಕಿ`)
        : `🟡 ${bus.availableSeats} Seats Left`;
    } else {
      occClass = 'available';
      occText = currentLanguage === 'KN'
        ? (bus.occupancyStatusKn || `🟢 ${bus.availableSeats} ಆಸನಗಳು ಲಭ್ಯ`)
        : `🟢 ${bus.availableSeats || 15} Seats Available`;
    }

    occPill.className = `occupancy-pill ${occClass}`;
    occPill.textContent = occText;
  }

  // Crowdsource Passenger Button State
  const crowdsourceBtn = document.getElementById('btn-crowdsource-toggle');
  const crowdsourceText = document.getElementById('crowdsource-btn-text');
  if (crowdsourceBtn && crowdsourceText) {
    const isBroadcasting = crowdsourceWatchId !== null && crowdsourceBusId === bus.id;
    if (isBroadcasting) {
      crowdsourceBtn.classList.add('broadcasting');
      crowdsourceText.textContent = I18N[currentLanguage].crowdsourceStop;
    } else {
      crowdsourceBtn.classList.remove('broadcasting');
      crowdsourceText.textContent = I18N[currentLanguage].crowdsourceStart;
    }
  }

  if (bus.nextStop) {
    document.getElementById('sheet-next-stop-name').textContent = bus.nextStop.name;
    document.getElementById('sheet-next-stop-kannada').textContent = bus.nextStop.kannadaName || '';
    document.getElementById('sheet-eta-time').textContent = bus.nextStop.etaFormatted;
    document.getElementById('sheet-eta-dist').textContent = `${bus.nextStop.distanceKm} km away`;
  }

  document.getElementById('sheet-speed').textContent = `${bus.speed || 0} km/h`;
  document.getElementById('sheet-direction').textContent = bus.direction || 'FORWARD';
  document.getElementById('sheet-dep-time').textContent = bus.departureTime || 'On Schedule';
  document.getElementById('sheet-fare').textContent = bus.fare || 'Standard';

  // Update Proximity Alarm Box
  updateAlertUI();

  // Render Stop Timeline
  const timelineEl = document.getElementById('sheet-timeline');
  timelineEl.innerHTML = '';

  if (bus.stopTimeline && bus.stopTimeline.length > 0) {
    bus.stopTimeline.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = `timeline-item ${item.status.toLowerCase()}`;
      
      const bellBtnHtml = item.status !== 'PASSED'
        ? `<button class="timeline-bell-btn" title="Set alarm for ${item.name}" data-stop-id="${item.id}" data-stop-name="${item.name}">🔔</button>`
        : '';

      itemDiv.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="stop-title">
            ${item.name} ${bellBtnHtml}
          </div>
          <div class="stop-sub">${item.kannadaName || ''} &bull; ${item.distanceKm} km</div>
        </div>
        <div class="timeline-eta">${item.etaFormatted}</div>
      `;
      timelineEl.appendChild(itemDiv);
    });

    // Wire up bell buttons
    timelineEl.querySelectorAll('.timeline-bell-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const stopId = btn.getAttribute('data-stop-id');
        openAlertModal(stopId);
      });
    });
  }
}

function openAlertModal(preselectedStopId) {
  const bus = busesMap.get(selectedBusId);
  if (!bus || !bus.stopTimeline) {
    alert("Please select a bus on the map first.");
    return;
  }

  const stopSelect = document.getElementById('modal-stop-select');
  stopSelect.innerHTML = '';

  const upcomingStops = bus.stopTimeline.filter(s => s.status !== 'PASSED');
  if (upcomingStops.length === 0) {
    alert("All stops on this trip have already been passed.");
    return;
  }

  upcomingStops.forEach(stop => {
    const opt = document.createElement('option');
    opt.value = stop.id;
    opt.textContent = `${stop.name} (${stop.distanceKm} km away - ${stop.etaFormatted})`;
    if (preselectedStopId && stop.id === preselectedStopId) {
      opt.selected = true;
    }
    stopSelect.appendChild(opt);
  });

  document.getElementById('alert-modal').classList.add('active');
}

function closeAlertModal() {
  document.getElementById('alert-modal').classList.remove('active');
}

function closeBusDetailSheet() {
  selectedBusId = null;
  document.getElementById('bus-detail-sheet').classList.remove('active');
}

function populateRouteSelector() {
  const select = document.getElementById('route-selector');
  select.innerHTML = '<option value="ALL">All Routes (ಎಲ್ಲಾ ಮಾರ್ಗಗಳು)</option>';
  routes.forEach(route => {
    const opt = document.createElement('option');
    opt.value = route.id;
    opt.textContent = `${route.name}`;
    select.appendChild(opt);
  });
}

// WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WS] Connected to KSRTC Telemetry Hub');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'INIT') {
        routes = msg.routes || [];
        stops = msg.stops || [];
        populateRouteSelector();
        renderRoutesAndStops();
        updateBusesOnMap(msg.buses || []);
      } else if (msg.type === 'BUS_UPDATE') {
        updateBusesOnMap(msg.buses || []);
      }
    } catch (e) {
      console.error('[WS] Error processing message:', e);
    }
  };

  ws.onclose = () => {
    console.warn('[WS] Connection closed. Reconnecting in 3s...');
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (err) => {
    console.error('[WS] Socket error:', err);
  };
}

// Setup Event Listeners
function setupEvents() {
  // Close sheet button
  document.getElementById('btn-close-sheet').addEventListener('click', closeBusDetailSheet);

  // Search input filter - dynamically triggers Place Transit Hub for any searched place
  document.getElementById('bus-search-input').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length >= 2) {
      const matchedStop = findStopBySearchTerm(val);
      if (matchedStop) {
        openPlaceHub(matchedStop.id, true);
      }
    } else if (val === '') {
      if (activeHubStopId) {
        closePlaceHub();
      }
    }
    updateBusesOnMap(Array.from(busesMap.values()));
  });

  // Close Place Hub Drawer
  const closeHubBtn = document.getElementById('btn-close-hub');
  if (closeHubBtn) {
    closeHubBtn.addEventListener('click', closePlaceHub);
  }

  // Place Hub Tabs: Incoming (Marching Towards) vs Outgoing (Marching Away)
  const tabIncoming = document.getElementById('tab-incoming');
  const tabOutgoing = document.getElementById('tab-outgoing');
  if (tabIncoming && tabOutgoing) {
    tabIncoming.addEventListener('click', () => {
      activeHubTab = 'incoming';
      tabIncoming.classList.add('active');
      tabOutgoing.classList.remove('active');
      refreshPlaceHub();
    });

    tabOutgoing.addEventListener('click', () => {
      activeHubTab = 'outgoing';
      tabOutgoing.classList.add('active');
      tabIncoming.classList.remove('active');
      refreshPlaceHub();
    });
  }

  // Route selector
  document.getElementById('route-selector').addEventListener('change', (e) => {
    currentRouteFilter = e.target.value;
    updateBusesOnMap(Array.from(busesMap.values()));

    if (currentRouteFilter !== 'ALL' && routeLayers.has(currentRouteFilter)) {
      map.fitBounds(routeLayers.get(currentRouteFilter).getBounds(), { padding: [40, 40] });
    }
  });

  // Fit Bounds
  document.getElementById('btn-fit-bounds').addEventListener('click', () => {
    if (currentRouteFilter !== 'ALL' && routeLayers.has(currentRouteFilter)) {
      map.fitBounds(routeLayers.get(currentRouteFilter).getBounds(), { padding: [40, 40] });
    } else {
      const allBounds = [];
      routeLayers.forEach(l => allBounds.push(l.getBounds()));
      if (allBounds.length > 0) {
        let merged = allBounds[0];
        for (let i = 1; i < allBounds.length; i++) merged.extend(allBounds[i]);
        map.fitBounds(merged, { padding: [30, 30] });
      }
    }
  });

  // User Location
  document.getElementById('btn-my-location').addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLatLng = [pos.coords.latitude, pos.coords.longitude];
          L.circleMarker(userLatLng, {
            radius: 8,
            fillColor: '#38bdf8',
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9
          }).addTo(map).bindPopup('📍 Your Location').openPopup();

          map.setView(userLatLng, 13);
        },
        (err) => {
          alert('Unable to get GPS location: ' + err.message);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  });

  // Toggle Simulator button
  document.getElementById('btn-toggle-sim').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/simulator/toggle', { method: 'POST' });
      const data = await res.json();
      simulatorEnabled = data.simulatorActive;
      alert(`Simulation ${simulatorEnabled ? 'Resumed ▶️' : 'Paused ⏸️'}`);
    } catch (e) {
      console.error('Failed to toggle simulator', e);
    }
  });

  // Proximity Alert Modal Open / Close
  document.getElementById('btn-open-alert-modal').addEventListener('click', () => {
    openAlertModal();
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    closeAlertModal();
  });

  // Cancel Active Alert
  document.getElementById('btn-cancel-alert').addEventListener('click', () => {
    activeAlert = null;
    updateAlertUI();
    alert('Proximity alarm cancelled.');
  });

  // Distance selection pills
  document.querySelectorAll('.pill-option').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill-option').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
      selectedThresholdKm = parseFloat(pill.getAttribute('data-km'));
    });
  });

  // Test Chime sound
  document.getElementById('btn-test-chime').addEventListener('click', () => {
    playTransitChime();
  });

  // Activate Proximity Alert
  document.getElementById('btn-confirm-alert').addEventListener('click', () => {
    const stopSelect = document.getElementById('modal-stop-select');
    const stopId = stopSelect.value;
    const selectedText = stopSelect.options[stopSelect.selectedIndex]?.textContent || 'Selected Stop';
    const stopName = selectedText.split('(')[0].trim();

    if (!selectedBusId || !stopId) {
      alert('Please select a valid stop.');
      return;
    }

    // Request notification permission if available
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Resume AudioContext on user gesture
    getAudioContext();

    activeAlert = {
      busId: selectedBusId,
      stopId: stopId,
      stopName: stopName,
      thresholdKm: selectedThresholdKm,
      triggered: false
    };

    closeAlertModal();
    updateAlertUI();

    // Play quick confirmation sound
    playTransitChime();

    // Vibrate briefly
    if (navigator.vibrate) {
      try { navigator.vibrate(100); } catch (e) {}
    }
  });

  // Dismiss Toast button
  document.getElementById('btn-dismiss-toast').addEventListener('click', () => {
    document.getElementById('proximity-toast').classList.remove('visible');
  });

  // Timetables Modal Events
  document.getElementById('btn-open-timetables').addEventListener('click', () => {
    renderTimetables('ALL');
    document.getElementById('timetable-modal').classList.add('active');
  });

  document.getElementById('btn-close-timetable-modal').addEventListener('click', () => {
    document.getElementById('timetable-modal').classList.remove('active');
  });

  document.getElementById('timetable-route-filter').addEventListener('change', (e) => {
    renderTimetables(e.target.value);
  });

  // Language Switch Button
  const langBtn = document.getElementById('btn-toggle-lang');
  if (langBtn) {
    langBtn.addEventListener('click', toggleLanguage);
  }

  // Crowdsource Passenger Location Toggle
  const crowdsourceBtn = document.getElementById('btn-crowdsource-toggle');
  if (crowdsourceBtn) {
    crowdsourceBtn.addEventListener('click', () => {
      const bus = busesMap.get(selectedBusId);
      if (!bus) return;

      if (crowdsourceWatchId !== null && crowdsourceBusId === bus.id) {
        // Stop broadcasting
        stopCrowdsourcing();
        alert(currentLanguage === 'KN' ? 'GPS ಹಂಚಿಕೊಳ್ಳುವುದನ್ನು ನಿಲ್ಲಿಸಲಾಗಿದೆ.' : 'Stopped sharing passenger GPS.');
      } else {
        // Start broadcasting
        if (!navigator.geolocation) {
          alert('Geolocation is not supported by your browser.');
          return;
        }

        crowdsourceBusId = bus.id;
        crowdsourceWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const speed = pos.coords.speed !== null ? Math.round(pos.coords.speed * 3.6) : bus.speed;
            const heading = pos.coords.heading || bus.heading || 0;

            fetch('/api/telemetry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                busId: bus.id,
                lat,
                lon,
                speed,
                heading,
                driverName: 'Passenger Crowdsource'
              })
            }).catch(err => console.log('Crowdsource update error:', err));
          },
          (err) => {
            console.warn('Crowdsource error:', err);
            alert('GPS Error: ' + err.message);
            stopCrowdsourcing();
          },
          { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
        );

        renderBusDetailSheet(bus);
        alert(currentLanguage === 'KN'
          ? 'ಧನ್ಯವಾದಗಳು! ನೀವು ಲೈವ್ GPS ಹಂಚಿಕೊಳ್ಳುತ್ತಿದ್ದೀರಿ.'
          : 'Thank you! Broadcasting live GPS for this bus.');
      }
    });
  }

  // PWA Install Button
  const installBtn = document.getElementById('btn-install-pwa');
  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[PWA] User response to install:', outcome);
    deferredInstallPrompt = null;
    installBtn.style.display = 'none';
  });
}

// Timetable Data and Rendering (Offline Cached)
let timetablesData = [];

async function loadTimetables() {
  try {
    const res = await fetch('/api/timetables');
    if (res.ok) {
      timetablesData = await res.json();
    }
  } catch (err) {
    console.warn('[Timetables] Using offline cached timetable data', err);
  }
}

function renderTimetables(filterRouteId = 'ALL') {
  const container = document.getElementById('timetable-list');
  container.innerHTML = '';

  const filtered = filterRouteId === 'ALL'
    ? timetablesData
    : timetablesData.filter(t => t.routeId === filterRouteId);

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px;">No timetables found for this route.</div>';
    return;
  }

  filtered.forEach(corridor => {
    const title = document.createElement('div');
    title.className = 'timetable-corridor-title';
    title.innerHTML = `${corridor.routeTitle} <span style="font-size: 11px; opacity: 0.8;">(${corridor.kannadaTitle || ''})</span>`;
    container.appendChild(title);

    corridor.schedules.forEach(item => {
      const card = document.createElement('div');
      card.className = 'timetable-card';
      card.innerHTML = `
        <div class="timetable-card-header">
          <div class="service-title">${item.serviceType}</div>
          <div class="service-fare">${item.fare}</div>
        </div>
        <div class="timetable-detail-grid">
          <div>Departs: <strong>${item.depTime}</strong></div>
          <div>Arrives: <strong>${item.arrTime}</strong></div>
          <div>Platform: <strong>${item.platform}</strong></div>
          <div>Class: <strong>${item.busClass}</strong></div>
        </div>
        <div style="font-size: 11px; color: #38bdf8; margin-top: 4px;">
          ⏱️ Frequency: ${item.frequency}
        </div>
      `;
      container.appendChild(card);
    });
  });
}

// Service Worker & PWA Handling
let deferredInstallPrompt = null;

function setupPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[PWA] Service Worker registered with scope:', reg.scope))
        .catch(err => console.warn('[PWA] Service Worker registration failed:', err));
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) installBtn.style.display = 'flex';
  });

  // Online / Offline Status Detection
  function updateOnlineStatus() {
    const offlinePill = document.getElementById('offline-pill');
    if (!navigator.onLine) {
      if (offlinePill) offlinePill.style.display = 'block';
    } else {
      if (offlinePill) offlinePill.style.display = 'none';
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEvents();
  setupPWA();
  loadTimetables();
  connectWebSocket();
});
