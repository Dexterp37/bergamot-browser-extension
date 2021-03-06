/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { browser, Runtime } from "webextension-polyfill-ts";
import Port = Runtime.Port;
import { captureExceptionWithExtras } from "./ErrorReporting";
import { nanoid } from "nanoid";
import { DetectedLanguageResults } from "../background-scripts/background.js/lib/LanguageDetector";

export class ContentScriptLanguageDetectorProxy {
  private backgroundContextPort: Port;
  constructor() {
    // console.debug("ContentScriptLanguageDetectorProxy: Connecting to the background script");
    this.backgroundContextPort = browser.runtime.connect(browser.runtime.id, {
      name: "port-from-content-script-language-detector-proxy",
    });
  }
  async detectLanguage(str: string): Promise<DetectedLanguageResults> {
    return new Promise((resolve, reject) => {
      const requestId = nanoid();
      const resultsMessageListener = async (m: {
        languageDetectorResults?: any;
      }) => {
        if (m.languageDetectorResults) {
          const { languageDetectorResults } = m;
          if (languageDetectorResults.requestId !== requestId) {
            return;
          }
          // console.debug("ContentScriptLanguageDetectorProxy received language detector results", {languageDetectorResults});
          this.backgroundContextPort.onMessage.removeListener(
            resultsMessageListener,
          );
          resolve(languageDetectorResults.results);
          return null;
        }
        captureExceptionWithExtras(new Error("Unexpected message"), { m });
        console.error("Unexpected message", { m });
        reject({ m });
      };
      this.backgroundContextPort.onMessage.addListener(resultsMessageListener);
      // console.debug("Attempting detectLanguage via content script proxy", {str});
      this.backgroundContextPort.postMessage({
        str,
        requestId,
      });
    });
  }
}
