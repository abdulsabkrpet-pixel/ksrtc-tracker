const fs = require('fs');
const path = require('path');
const { getDistanceKm, getBearing, interpolate, formatEtaMinutes } = require('./geoUtils');

class TrackingEngine {
  constructor() {
    this.routes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/routes.json'), 'utf8'));
    this.stops = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/stops.json'), 'utf8'));
    this.stopsMap = new Map(this.stops.map(s => [s.id, s]));
    this.routesMap = new Map(this.routes.map(r => [r.id, r]));

    const initialBuses = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/buses.json'), 'utf8'));
    this.buses = new Map();
    this.listeners = new Set();
    this.simulatorActive = true;

    // Initialize bus positions
    initialBuses.forEach(b => {
      const route = this.routesMap.get(b.routeId);
      if (route && route.waypoints.length > 1) {
        const wpIdx = Math.min(b.currentWaypointIndex || 0, route.waypoints.length - 2);
        const p1 = route.waypoints[wpIdx];
        const p2 = route.waypoints[wpIdx + 1];
        const currentCoord = interpolate(p1, p2, b.progressPct || 0);
        const heading = getBearing(p1[0], p1[1], p2[0], p2[1]);

        this.buses.set(b.id, {
          ...b,
          currentLat: currentCoord[0],
          currentLon: currentCoord[1],
          heading: Math.round(heading),
          segmentIndex: wpIdx,
          segmentProgress: b.progressPct || 0,
          dwellCounter: 0,
          lastUpdated: new Date().toISOString()
        });
      }
    });

    // Compute initial stop ETAs
    for (const bus of this.buses.values()) {
      this.recalculateStopETAs(bus);
    }

    // Start simulation loop (runs every 2.5s)
    this.startSimulation();
  }

  // Recalculates distance to all stops along the route and upcoming ETA
  recalculateStopETAs(bus) {
    const route = this.routesMap.get(bus.routeId);
    if (!route) return;

    const routeStops = route.stops.map(stopId => this.stopsMap.get(stopId)).filter(Boolean);
    const busCoord = [bus.currentLat, bus.currentLon];

    let minDistance = Infinity;
    let closestStopIndex = 0;

    // Find the stop closest to the bus
    routeStops.forEach((stop, index) => {
      const dist = getDistanceKm(busCoord[0], busCoord[1], stop.coordinates[0], stop.coordinates[1]);
      if (dist < minDistance) {
        minDistance = dist;
        closestStopIndex = index;
      }
    });

    // Target the next stop in travel direction
    let nextStopIndex;
    if (bus.direction === 'FORWARD') {
      // If we are within 200m of the stop, we might be currently at it
      nextStopIndex = Math.min(closestStopIndex + (minDistance < 0.25 ? 1 : 0), routeStops.length - 1);
    } else {
      nextStopIndex = Math.max(closestStopIndex - (minDistance < 0.25 ? 1 : 0), 0);
    }

    const nextStop = routeStops[nextStopIndex] || routeStops[0];
    const distToNextStopKm = getDistanceKm(busCoord[0], busCoord[1], nextStop.coordinates[0], nextStop.coordinates[1]);
    const effectiveSpeed = Math.max(bus.speed, 35); // km/h
    const etaMinutes = (distToNextStopKm / effectiveSpeed) * 60;

    bus.nextStop = {
      id: nextStop.id,
      name: nextStop.name,
      kannadaName: nextStop.kannadaName,
      distanceKm: parseFloat(distToNextStopKm.toFixed(1)),
      etaMinutes: Math.round(etaMinutes),
      etaFormatted: formatEtaMinutes(etaMinutes)
    };

    // Calculate timeline for all stops
    bus.stopTimeline = routeStops.map((stop, idx) => {
      const dist = getDistanceKm(busCoord[0], busCoord[1], stop.coordinates[0], stop.coordinates[1]);
      let status = 'UPCOMING';
      if (bus.direction === 'FORWARD') {
        if (idx < nextStopIndex) status = 'PASSED';
        else if (idx === nextStopIndex) status = 'NEXT';
      } else {
        if (idx > nextStopIndex) status = 'PASSED';
        else if (idx === nextStopIndex) status = 'NEXT';
      }

      // Compute cumulative ETA
      const stopEtaMin = (dist / effectiveSpeed) * 60;
      return {
        id: stop.id,
        name: stop.name,
        kannadaName: stop.kannadaName,
        status,
        distanceKm: parseFloat(dist.toFixed(1)),
        etaFormatted: status === 'PASSED' ? 'Departed' : (status === 'NEXT' && dist < 0.3 ? 'Arriving now' : formatEtaMinutes(stopEtaMin))
      };
    });
  }

  startSimulation() {
    this.simInterval = setInterval(() => {
      if (!this.simulatorActive) return;

      for (const [id, bus] of this.buses.entries()) {
        // If the bus has active real-world manual telemetry from a driver device, don't simulate it
        if (bus.isLiveManual) continue;

        // If the bus is dwelling at a station, countdown dwell
        if (bus.dwellCounter > 0) {
          bus.dwellCounter--;
          bus.speed = 0;
          continue;
        }

        // Initialize missing fields defensively
        if (typeof bus.segmentIndex !== 'number' || isNaN(bus.segmentIndex)) bus.segmentIndex = 0;
        if (typeof bus.segmentProgress !== 'number' || isNaN(bus.segmentProgress)) bus.segmentProgress = 0;

        // Normal driving speed (between 45 and 75 km/h with random realistic variations)
        const baseSpeed = bus.type && bus.type.includes('AC') ? 68 : 56;
        bus.speed = Math.floor(baseSpeed + (Math.random() * 12 - 6));

        const route = this.routesMap.get(bus.routeId);
        if (!route || !route.waypoints || route.waypoints.length < 2) continue;

        const waypoints = route.waypoints;
        const totalSegments = waypoints.length - 1;

        // Progress step per tick (~2.5s)
        const step = 0.05 + Math.random() * 0.03;

        if (bus.direction === 'FORWARD') {
          bus.segmentProgress += step;
          if (bus.segmentProgress >= 1.0) {
            bus.segmentProgress = 0;
            bus.segmentIndex++;

            if (bus.segmentIndex >= totalSegments) {
              // Reached destination! Reverse direction after dwell
              bus.segmentIndex = totalSegments - 1;
              bus.segmentProgress = 1.0;
              bus.direction = 'REVERSE';
              bus.dwellCounter = 4; // dwell for ~10 seconds
            }
          }
        } else {
          // REVERSE direction
          bus.segmentProgress -= step;
          if (bus.segmentProgress <= 0) {
            bus.segmentProgress = 1.0;
            bus.segmentIndex--;

            if (bus.segmentIndex < 0) {
              // Reached origin! Turn forward after dwell
              bus.segmentIndex = 0;
              bus.segmentProgress = 0;
              bus.direction = 'FORWARD';
              bus.dwellCounter = 4;
            }
          }
        }

        const segIdx = Math.max(0, Math.min(bus.segmentIndex, totalSegments - 1));
        const p1 = waypoints[segIdx];
        const p2 = waypoints[Math.min(segIdx + 1, waypoints.length - 1)];

        if (!p1 || !p2) continue;

        const nextCoord = interpolate(p1, p2, bus.segmentProgress);
        const heading = bus.direction === 'FORWARD'
          ? getBearing(p1[0], p1[1], p2[0], p2[1])
          : getBearing(p2[0], p2[1], p1[0], p1[1]);

        bus.currentLat = nextCoord[0];
        bus.currentLon = nextCoord[1];
        bus.heading = Math.round(heading);
        bus.lastUpdated = new Date().toISOString();

        this.recalculateStopETAs(bus);
      }

      this.notifyListeners();
    }, 2500);
  }

  // Update telemetry manually (Driver App or external GPS feed)
  updateBusTelemetry(busId, { lat, lon, speed, heading, driverName }) {
    let bus = this.buses.get(busId);
    if (!bus) {
      // Check if busId matched any bus's regNumber
      for (const b of this.buses.values()) {
        if (b.regNumber === busId) {
          bus = b;
          break;
        }
      }
    }

    if (!bus) {
      bus = {
        id: busId,
        regNumber: busId,
        serviceName: "KSRTC Live Driver Bus",
        type: "Express",
        badgeColor: "#b91c1c",
        routeId: "KA-BLR-MYS-01",
        driverName: driverName || "Active Driver",
        direction: "FORWARD",
        departureTime: "Live",
        fare: "Standard",
        segmentIndex: 0,
        segmentProgress: 0
      };
      this.buses.set(busId, bus);
    }

    bus.isLiveManual = true;
    bus.currentLat = lat;
    bus.currentLon = lon;
    if (speed !== undefined) bus.speed = speed;
    if (heading !== undefined) bus.heading = heading;
    if (driverName) bus.driverName = driverName;
    bus.lastUpdated = new Date().toISOString();

    this.recalculateStopETAs(bus);
    this.notifyListeners();
    return bus;
  }

  toggleSimulator(enable) {
    this.simulatorActive = enable !== undefined ? enable : !this.simulatorActive;
    return this.simulatorActive;
  }

  getBuses() {
    return Array.from(this.buses.values());
  }

  getBus(id) {
    return this.buses.get(id);
  }

  getRoutes() {
    return this.routes;
  }

  getRoute(id) {
    return this.routesMap.get(id);
  }

  getStops() {
    return this.stops;
  }

  onUpdate(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    const data = this.getBuses();
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (err) {
        console.error('Error notifying telemetry listener:', err);
      }
    }
  }
}

module.exports = new TrackingEngine();
