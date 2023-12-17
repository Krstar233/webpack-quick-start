import Parse from "parse";

export const CONFIG = {
  ParseServer: {
    URL: "https://172.22.16.1:1337/parse",
    JavaScriptKey: "JS_KEY",
    AppId: "APPLICATION_ID",
  },
};

Parse.initialize(CONFIG.ParseServer.AppId);
Parse.serverURL = CONFIG.ParseServer.URL;
Parse.javaScriptKey = CONFIG.ParseServer.JavaScriptKey;
Parse.CoreManager.setStorageController(Parse.IndexedDB);
