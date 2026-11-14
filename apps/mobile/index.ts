import * as Sentry from "@sentry/react-native";
import { registerRootComponent } from "expo";

import App from "./src/App";
import { initObservability } from "./src/lib/analytics";

initObservability();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Sentry.wrap(App));
