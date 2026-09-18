# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Rebuild and deploy to the test phones

After a code change, rebuild the release APK and reinstall it on both wirelessly-paired devices:

```bash
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a && cd ..
adb -s $S22   install -r android/app/build/outputs/apk/release/app-release.apk
adb -s $PIXEL install -r android/app/build/outputs/apk/release/app-release.apk

adb -s $S22   shell monkey -p com.vcollaborate.hulls_and_hellfire -c android.intent.category.LAUNCHER 1
adb -s $PIXEL shell monkey -p com.vcollaborate.hulls_and_hellfire -c android.intent.category.LAUNCHER 1
```

`$S22` and `$PIXEL` are the devices' `IP:PORT` endpoints from `adb devices`. See
[docs/how-to/two-device-debugging.md](docs/how-to/two-device-debugging.md) for wireless pairing,
and for the dev-build + Metro loop if you want Fast Refresh instead of a rebuild.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
