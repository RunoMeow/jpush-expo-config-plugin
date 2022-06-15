import { IOSConfig, withMod, BaseMods } from '@expo/config-plugins';
import fs from 'fs';

const withAppDelegateHeaderBaseMod = (config) => BaseMods.withIosBaseMods(config, {
  skipEmptyMod: true,
  providers: {
    appDelegateHeader: BaseMods.provider({
      getFilePath({ modRequest: { projectRoot } }) {
        const filePath = IOSConfig.Paths.getAppDelegateFilePath(projectRoot);
        // Replace the .mm with a .h
        const [lastfix] = filePath.split('.').slice(-1);
        if (lastfix.endsWith('m')) {
          const fileStrArray = filePath.split('.');
          return [...filePath.split('.').slice(0,fileStrArray.length - 1), 'h'].join('.');
        }
        // Possibly a Swift project...
        throw new Error(`Could not locate a valid AppDelegate.h at root: "${projectRoot}"`);
      },
      // Read the input file from the filesystem.
      async read(filePath) {
        return IOSConfig.Paths.getFileInfo(filePath);
      },
      // Write the resulting output to the filesystem.
      async write(filePath, { modResults: { contents } }) {
        let newContents = contents;
        if (contents.indexOf('#import <RCTJPushModule.h>') === -1) {
          newContents = `#import <RCTJPushModule.h>
          ` + contents;
        }
        const reg = /\@interface\ AppDelegate\ \: EXAppDelegateWrapper\ \<(.*?)\>/;
        const [str] = newContents.match(reg);
        if (str.indexOf('JPUSHRegisterDelegate') === -1 && str.indexOf('JPUSHGeofenceDelegate') === -1) {
          const { index } = newContents.match(reg);
          const startIndex = index + str.length - 1;
          newContents = newContents.slice(0, startIndex) + `, JPUSHRegisterDelegate, JPUSHGeofenceDelegate` + newContents.slice(startIndex);
        }
        await fs.promises.writeFile(filePath, newContents); 
      },
    })
  }
})

const withAppDelegateHeader = (
  config,
  action
) => {
  return withMod(config, {
    platform: 'ios',
    mod: 'appDelegateHeader',
    action,
  });
};

const withSimpleAppDelegateHeaderMod = config => {
  return withAppDelegateHeader(config, config => {
    console.log('modify header:', config.modResults);
    return config;
  });
};

export default ({ config }) => {
  if (!config.plugins) config.plugins = [];
  config.plugins.push(
    withSimpleAppDelegateHeaderMod,

    // Base mods MUST be last
    withAppDelegateHeaderBaseMod
  );
  return config;
};
