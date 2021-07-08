const {
  AndroidConfig,
  withAppBuildGradle,
  withSettingsGradle,
  withAndroidManifest,
  withAppDelegate,
} = require('@expo/config-plugins');

let JPUSH_APPKEY = 'appKey',
  JPUSH_CHANNEL = 'channel';

const withJPush = (config, props) => {
  if (!props || !props.appKey || !props.channel)
    throw new Error('[JPushPlugin] 请传入参数 appKey & channel');
  JPUSH_APPKEY = props.appKey;
  JPUSH_CHANNEL = props.channel;
  config = setAndroidManifest(config);
  config = setAppBuildGradle(config);
  config = setSettingsGradle(config);
  config = setAppDelegate(config);

  return config;
};

// 配置 iOS AppDelegate
const setAppDelegate = (config) =>
  withAppDelegate(config, (config) => {
    if (
      config.modResults.contents.indexOf('#import <RCTJPushModule.h>') === -1
    ) {
      console.log('\n[JPushPlugin] 配置 AppDelegate import ... ');
      config.modResults.contents =
        `#import <RCTJPushModule.h>
#ifdef NSFoundationVersionNumber_iOS_9_x_Max
#import <UserNotifications/UserNotifications.h>
#endif

` + config.modResults.contents;
    }
    const didFinishLaunchingWithOptionsResult =
      config.modResults.contents.match(
        /didFinishLaunchingWithOptions([\s\S]*)launchOptions\n\{\n/
      );
    const [didFinishLaunchingWithOptions] = didFinishLaunchingWithOptionsResult;
    const didFinishLaunchingWithOptionsIndex =
      didFinishLaunchingWithOptionsResult.index;
    const didFinishLaunchingWithOptionsStartIndex =
      didFinishLaunchingWithOptionsIndex + didFinishLaunchingWithOptions.length;
    if (
      config.modResults.contents.indexOf(
        'JPUSHService setupWithOption:launchOptions'
      ) === -1
    ) {
      console.log(
        '\n[JPushPlugin] 配置 AppDelegate didFinishLaunchingWithOptions ... '
      );
      config.modResults.contents =
        config.modResults.contents.slice(
          0,
          didFinishLaunchingWithOptionsStartIndex
        ) +
        `  // JPush初始化配置
  [JPUSHService setupWithOption:launchOptions appKey:@"${JPUSH_APPKEY}" channel:@"${JPUSH_CHANNEL}" apsForProduction:YES];
  // APNS
  JPUSHRegisterEntity * entity = [[JPUSHRegisterEntity alloc] init];
  if (@available(iOS 12.0, *)) {
    entity.types = JPAuthorizationOptionAlert|JPAuthorizationOptionBadge|JPAuthorizationOptionSound|JPAuthorizationOptionProvidesAppNotificationSettings;
  }
  [JPUSHService registerForRemoteNotificationConfig:entity delegate:self];
  [launchOptions objectForKey: UIApplicationLaunchOptionsRemoteNotificationKey];
  // 自定义消息
  NSNotificationCenter *defaultCenter = [NSNotificationCenter defaultCenter];
  [defaultCenter addObserver:self selector:@selector(networkDidReceiveMessage:) name:kJPFNetworkDidReceiveMessageNotification object:nil];
  // 地理围栏
  [JPUSHService registerLbsGeofenceDelegate:self withLaunchOptions:launchOptions];
#if defined(FB_SONARKIT_ENABLED) && __has_include(<FlipperKit/FlipperClient.h>)
  InitializeFlipper(application);
#endif
` +
        config.modResults.contents.slice(
          didFinishLaunchingWithOptionsStartIndex
        );
    } else {
      console.log('\n[JPushPlugin] 配置 AppDelegate appKey & channel ... ');
      config.modResults.contents = config.modResults.contents.replace(
        /appKey\:\@\"(.*)\" channel\:\@\"(.*)\" /,
        `appKey:@"${JPUSH_APPKEY}" channel:@"${JPUSH_CHANNEL}" `
      );
    }
    if (
      config.modResults.contents.indexOf(
        '// ************************************************JPush start************************************************'
      ) === -1
    ) {
      console.log('\n[JPushPlugin] 配置 AppDelegate other ... ');
      config.modResults.contents = config.modResults.contents.replace(
        /\@end([\n]*)$/,
        `// ************************************************JPush start************************************************

//注册 APNS 成功并上报 DeviceToken
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [JPUSHService registerDeviceToken:deviceToken];
}

// iOS 7 APNS
- (void)application:(UIApplication *)application didReceiveRemoteNotification:  (NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  // iOS 10 以下 Required
  NSLog(@"iOS 7 APNS");
  [JPUSHService handleRemoteNotification:userInfo];
  [[NSNotificationCenter defaultCenter] postNotificationName:J_APNS_NOTIFICATION_ARRIVED_EVENT object:userInfo];
  completionHandler(UIBackgroundFetchResultNewData);
}

// iOS 10 前台收到消息
- (void)jpushNotificationCenter:(UNUserNotificationCenter *)center  willPresentNotification:(UNNotification *)notification withCompletionHandler:(void (^)(NSInteger))completionHandler {
  NSDictionary * userInfo = notification.request.content.userInfo;
  if([notification.request.trigger isKindOfClass:[UNPushNotificationTrigger class]]) {
    // Apns
    NSLog(@"iOS 10 APNS 前台收到消息");
    [JPUSHService handleRemoteNotification:userInfo];
    [[NSNotificationCenter defaultCenter] postNotificationName:J_APNS_NOTIFICATION_ARRIVED_EVENT object:userInfo];
  }
  else {
    // 本地通知 todo
    NSLog(@"iOS 10 本地通知 前台收到消息");
    [[NSNotificationCenter defaultCenter] postNotificationName:J_LOCAL_NOTIFICATION_ARRIVED_EVENT object:userInfo];
  }
  //需要执行这个方法，选择是否提醒用户，有 Badge、Sound、Alert 三种类型可以选择设置
  completionHandler(UNNotificationPresentationOptionAlert);
}

// iOS 10 消息事件回调
- (void)jpushNotificationCenter:(UNUserNotificationCenter *)center didReceiveNotificationResponse:(UNNotificationResponse *)response withCompletionHandler: (void (^)(void))completionHandler {
  NSDictionary * userInfo = response.notification.request.content.userInfo;
  if([response.notification.request.trigger isKindOfClass:[UNPushNotificationTrigger class]]) {
    // Apns
    NSLog(@"iOS 10 APNS 消息事件回调");
    [JPUSHService handleRemoteNotification:userInfo];
    // 保障应用被杀死状态下，用户点击推送消息，打开app后可以收到点击通知事件
    [[RCTJPushEventQueue sharedInstance]._notificationQueue insertObject:userInfo atIndex:0];
    [[NSNotificationCenter defaultCenter] postNotificationName:J_APNS_NOTIFICATION_OPENED_EVENT object:userInfo];
  }
  else {
    // 本地通知
    NSLog(@"iOS 10 本地通知 消息事件回调");
    // 保障应用被杀死状态下，用户点击推送消息，打开app后可以收到点击通知事件
    [[RCTJPushEventQueue sharedInstance]._localNotificationQueue insertObject:userInfo atIndex:0];
    [[NSNotificationCenter defaultCenter] postNotificationName:J_LOCAL_NOTIFICATION_OPENED_EVENT object:userInfo];
  }
  // 系统要求执行这个方法
  completionHandler();
}

// 自定义消息
- (void)networkDidReceiveMessage:(NSNotification *)notification {
  NSDictionary * userInfo = [notification userInfo];
  [[NSNotificationCenter defaultCenter] postNotificationName:J_CUSTOM_NOTIFICATION_EVENT object:userInfo];
}

// ************************************************JPush end************************************************

@end
`
      );
    }

    return config;
  });

// 配置 Android AndroidManifest
const setAndroidManifest = (config) =>
  withAndroidManifest(config, (config) => {
    if (
      AndroidConfig.Manifest.findMetaDataItem(
        config.modResults.manifest.application[0],
        'JPUSH_CHANNEL'
      ) === -1
    ) {
      console.log('\n[JPushPlugin] 配置 AndroidManifest meta-data ... ');
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        config.modResults.manifest.application[0],
        'JPUSH_CHANNEL',
        '${JPUSH_CHANNEL}'
      );
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        config.modResults.manifest.application[0],
        'JPUSH_APPKEY',
        '${JPUSH_APPKEY}'
      );
      console.log('\n[JPushPlugin] 配置 AndroidManifest xmlns:tools ... ');
      config.modResults.manifest.$['xmlns:tools'] =
        'http://schemas.android.com/tools';
      console.log('\n[JPushPlugin] 配置 AndroidManifest activity ... ');
      config.modResults.manifest.application[0].activity.push({
        $: {
          'android:name': 'cn.jpush.android.service.JNotifyActivity',
          'android:exported': 'true',
          'tools:node': 'replace',
          'android:taskAffinity': 'jpush.custom',
          'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'cn.jpush.android.intent.JNotifyActivity',
                },
              },
            ],
            category: [
              {
                $: {
                  'android:name': 'android.intent.category.DEFAULT',
                },
              },
              {
                $: {
                  'android:name': '${applicationId}',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });

// 配置 Android build.gradle
const setAppBuildGradle = (config) =>
  withAppBuildGradle(config, (config) => {
    const defaultConfig = config.modResults.contents.match(
      /defaultConfig([\s\S]*)versionName(.*)\n/
    );
    if (defaultConfig) {
      const [startString] = defaultConfig;
      const startStringLength = startString.length;
      const startStringIndex =
        config.modResults.contents.indexOf(startString) + startStringLength;
      // 判断是否已配置
      if (config.modResults.contents.indexOf('JPUSH_APPKEY') === -1) {
        // 插入 build.gradle defaultConfig 配置
        console.log('\n[JPushPlugin] 配置 build.gradle defaultConfig ... ');
        config.modResults.contents =
          config.modResults.contents.slice(0, startStringIndex) +
          `        manifestPlaceholders = [
            JPUSH_APPKEY: "${JPUSH_APPKEY}",
            JPUSH_CHANNEL: "${JPUSH_CHANNEL}"
        ]\n` +
          config.modResults.contents.slice(startStringIndex);
      } else {
        // 更新 build.gradle defaultConfig 配置
        console.log('\n[JPushPlugin] 配置 build.gradle appKey & channel ... ');
        config.modResults.contents = config.modResults.contents.replace(
          /manifestPlaceholders([\s\S]*)JPUSH_APPKEY([\s\S]*)JPUSH_CHANNEL(.*)"\n(.*)\]\n/,
          `manifestPlaceholders = [
            JPUSH_APPKEY: "${JPUSH_APPKEY}",
            JPUSH_CHANNEL: "${JPUSH_CHANNEL}"
        ]\n`
        );
      }
    } else
      throw new Error(
        '[JPushPlugin] 无法完成 build.gradle - defaultConfig 配置'
      );
    if (
      config.modResults.contents.indexOf(
        `implementation project(':jpush-react-native')`
      ) === -1
    ) {
      console.log('\n[JPushPlugin] 配置 build.gradle dependencies ... ');
      const dependencies = config.modResults.contents.match(/dependencies {\n/);
      if (dependencies) {
        const [startString] = dependencies;
        const startStringLength = startString.length;
        const startStringIndex =
          config.modResults.contents.indexOf(startString) + startStringLength;
        // 插入 build.gradle dependencies 配置
        config.modResults.contents =
          config.modResults.contents.slice(0, startStringIndex) +
          `    implementation project(':jpush-react-native')
    implementation project(':jcore-react-native')\n` +
          config.modResults.contents.slice(startStringIndex);
      } else
        throw new Error(
          '[JPushPlugin] 无法完成 build.gradle dependencies 配置'
        );
    }

    return config;
  });

// 配置 Android settings.gradle
const setSettingsGradle = (config) =>
  withSettingsGradle(config, (config) => {
    if (
      config.modResults.contents.indexOf(`include ':jpush-react-native'`) === -1
    ) {
      console.log('\n[JPushPlugin] 配置 settings.gradle ... ');
      config.modResults.contents =
        config.modResults.contents +
        `
include ':jpush-react-native'
project(':jpush-react-native').projectDir = new File(rootProject.projectDir, '../node_modules/jpush-react-native/android')
include ':jcore-react-native'
project(':jcore-react-native').projectDir = new File(rootProject.projectDir, '../node_modules/jcore-react-native/android')`;
    }

    return config;
  });

module.exports = withJPush;
