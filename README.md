# jpush-expo-config-plugin

An expo config plugin for JPush

一个极光推送的 Expo 自动配置插件, 免去配置原生项目的繁琐步骤

此软件包不能在 "Expo Go" 应用程序中使用

## 1. 安装

```
npm install jpush-expo-config-plugin --save
或者
yarn add jpush-expo-config-plugin
```

> 注意: 如果项目里没有 jpush-react-native、jcore-react-native, 需要安装
>
> ```
> npm install jpush-react-native jcore-react-native --save
> 或者
> yarn add jpush-react-native jcore-react-native
> ```

## 2. 配置

安装此 npm 包后, 请将 [配置插件](https://docs.expo.io/guides/config-plugins/) 添加到 app.json 或 app.config.js 的 [插件数组](https://docs.expo.io/versions/latest/config/app/#plugins) :

app.json

```json
{
  "expo": {
    "plugins": [
      [
        "jpush-expo-config-plugin",
        {
          "appKey": "你的极光推送AppKey",
          "channel": "你的极光推送Channel"
        }
      ]
    ]
  }
}
```

接下来, 按照 ["添加自定义 Native 代码"](https://docs.expo.io/workflow/customizing/) 指南中的描述重新构建应用程序

```
expo prebuild
```
