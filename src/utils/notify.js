import { Alert, Platform } from "react-native";

// react-native-web's Alert.alert does nothing in the browser, so on the web we use the
// browser's own alert / confirm boxes. On phones it is the normal pop-up.
export function showAlert(title, message, buttons) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const actionButton = buttons && buttons.find((b) => b.style !== "cancel");
  if (actionButton && buttons.length > 1) {
    if (window.confirm(text)) actionButton.onPress && actionButton.onPress();
  } else {
    window.alert(text);
    if (actionButton && actionButton.onPress) actionButton.onPress();
  }
}
