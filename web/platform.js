// 跨平台接口唯一入口；书内业务不依赖具体平台。
import {createBrowserPlatform} from './platform/browser.js';
import {createNativePlatform} from './platform/native.js';
export const platform=window.__TAURI_INTERNALS__?await createNativePlatform():createBrowserPlatform();
