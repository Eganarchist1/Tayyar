import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

function htmlForMap(input: {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
}) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #071019; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const pickup = [${input.pickupLat}, ${input.pickupLng}];
        const delivery = [${input.deliveryLat}, ${input.deliveryLng}];
        const map = L.map('map', { zoomControl: true }).setView(pickup, 13);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        L.marker(pickup).addTo(map).bindPopup('Pickup');
        L.marker(delivery).addTo(map).bindPopup('Drop-off');
        const route = L.polyline([pickup, delivery], { color: '#0ea5e9', weight: 4, opacity: 0.85 }).addTo(map);
        map.fitBounds(route.getBounds(), { padding: [24, 24] });
      </script>
    </body>
  </html>`;
}

export default function MissionMap(props: {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
}) {
  return (
    <View style={styles.wrap}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: htmlForMap(props) }}
        style={styles.webview}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 240,
    overflow: "hidden",
    borderRadius: 24,
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
