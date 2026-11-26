// Leaflet + OpenStreetMap page used by the live map (no API key needed)
export const LIVE_MAP_HTML = `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0}.lbl{font:600 12px sans-serif}</style>
</head><body><div id="map"></div>
<script>
var map = L.map('map').setView([7.8731, 80.7718], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap'}).addTo(map);
var markers = {};
var fitted = false;
window.updateMarkers = function (list) {
  var seen = {};
  list.forEach(function (p) {
    seen[p.technician_id] = true;
    var stale = p.seconds_ago > 600;
    var color = stale ? '#9CA3AF' : '#16A34A';
    var latlng = [p.latitude, p.longitude];
    var mins = Math.round(p.seconds_ago / 60);
    var when = p.seconds_ago < 90 ? 'just now' : mins + ' min ago';
    var html = '<b>' + p.name + '</b><br>' + p.job_number + (p.customer_name ? ' - ' + p.customer_name : '') + '<br>Updated ' + when;
    var m = markers[p.technician_id];
    if (!m) {
      m = L.circleMarker(latlng, {radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1}).addTo(map);
      m.bindTooltip(p.name.split(' - ')[0], {permanent: true, direction: 'top', offset: [0, -8], className: 'lbl'});
      markers[p.technician_id] = m;
    } else {
      m.setLatLng(latlng);
      m.setStyle({fillColor: color});
    }
    m.unbindPopup();
    m.bindPopup(html);
  });
  Object.keys(markers).forEach(function (id) {
    if (!seen[id]) { map.removeLayer(markers[id]); delete markers[id]; }
  });
  var pts = list.map(function (p) { return [p.latitude, p.longitude]; });
  if (pts.length && !fitted) {
    fitted = true;
    map.fitBounds(pts, {padding: [40, 40], maxZoom: 15});
  }
};
</script></body></html>`;
