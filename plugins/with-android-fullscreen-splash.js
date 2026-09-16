const { withAndroidStyles, withDangerousMod, withMainActivity } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DRAWABLE = 'splash_window_background';
const SOURCE_IMAGE = 'assets/images/splash-window-bg.jpg';

const LAYER_LIST = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background" />
  <item>
    <bitmap android:src="@drawable/${DRAWABLE}_image" android:gravity="fill" />
  </item>
</layer-list>
`;

/**
 * Android's system splash can only draw a small centred icon, and
 * expo-splash-screen holds that splash until React renders — so the artwork
 * never fills the screen before the app mounts.
 *
 * Dropping the hold lets the system splash dismiss on the activity's first
 * frame, which uncovers AppTheme's window background: the same artwork, full
 * screen, until the JS splash overlay takes over.
 */
const withFullscreenSplash = config => {
  config = withDangerousMod(config, [
    'android',
    async cfg => {
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res');
      const nodpi = path.join(res, 'drawable-nodpi');
      fs.mkdirSync(nodpi, { recursive: true });
      fs.copyFileSync(
        path.join(cfg.modRequest.projectRoot, SOURCE_IMAGE),
        path.join(nodpi, `${DRAWABLE}_image.jpg`),
      );
      fs.writeFileSync(path.join(res, 'drawable', `${DRAWABLE}.xml`), LAYER_LIST);
      return cfg;
    },
  ]);

  config = withAndroidStyles(config, cfg => {
    const appTheme = cfg.modResults.resources.style?.find(s => s.$.name === 'AppTheme');
    appTheme.item = appTheme.item.filter(i => i.$.name !== 'android:windowBackground');
    appTheme.item.push({ _: `@drawable/${DRAWABLE}`, $: { name: 'android:windowBackground' } });
    return cfg;
  });

  return withMainActivity(config, cfg => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      'SplashScreenManager.registerOnActivity(this)',
      'setTheme(R.style.AppTheme)',
    );
    return cfg;
  });
};

module.exports = withFullscreenSplash;
