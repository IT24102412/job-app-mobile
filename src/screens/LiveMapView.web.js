import React, { useRef, useEffect, useState } from "react";
import { View } from "react-native";
import { LIVE_MAP_HTML } from "../utils/liveMapHtml";

export default function LiveMapView({ points }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const win = ref.current && ref.current.contentWindow;
    if (ready && win && win.updateMarkers) {
      win.updateMarkers(points);
    }
  }, [points, ready]);

  return (
    <View style={{ flex: 1 }}>
      {React.createElement("iframe", {
        ref,
        srcDoc: LIVE_MAP_HTML,
        onLoad: () => setReady(true),
        style: { border: 0, width: "100%", height: "100%" },
        title: "Live map",
      })}
    </View>
  );
}
