import Parse from "parse";

export const CONFIG = {
  ParseServer: {
    URL: "https://127.0.0.1:1337/parse",
    JavaScriptKey: "JS_KEY",
    AppId: "APPLICATION_ID",
  },
};

export const CALLER_NAME = "caller";
export const CALLEE_NAME = "callee";

Parse.initialize(CONFIG.ParseServer.AppId);
Parse.serverURL = CONFIG.ParseServer.URL;
Parse.javaScriptKey = CONFIG.ParseServer.JavaScriptKey;
Parse.CoreManager.setStorageController(Parse.IndexedDB);
