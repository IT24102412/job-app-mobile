import React, { useRef, useEffect, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { LIVE_MAP_HTML } from "../utils/liveMapHtml";

export default function LiveMapView({ points }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready && ref.current) {
      ref.current.injectJavaScript(`window.updateMarkers(${JSON.stringify(points)}); true;`);
    }
  }, [points, ready]);

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={{ html: LIVE_MAP_HTML }}
        javaScriptEnabled
        domStorageEnabled
        onLoadEnd={() => setReady(true)}
        style={{ flex: 1 }}
      />
    </View>
  );
}
