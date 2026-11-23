import * as Sentry from "@sentry/react-native";
import { registerRootComponent } from "expo";
import { registerWidgetTaskHandler } from "react-native-android-widget";

import App from "./src/App";
import { initObservability } from "./src/lib/analytics";
import { widgetTaskHandler } from "./src/widget/widget-task-handler";

initObservability();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Sentry.wrap(App));

// Home-screen widget (Android only - the library no-ops elsewhere): renders from the local SQLite
// mirror in a headless task, independent of whether the app UI is running.
registerWidgetTaskHandler(widgetTaskHandler);
