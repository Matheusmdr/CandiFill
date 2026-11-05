# Browser compatibility and publishing

**Last checked:** November 5, 2026. Safari is out of scope.

## Compatibility matrix

| Browser family | Minimum version | Package | Status |
| --- | --- | --- | --- |
| Firefox desktop | 140 | `candifill-firefox.zip` | Manifest and Firefox data-consent flow are configured. |
| Firefox for Android | 142 | `candifill-firefox.zip` | Minimum is set separately because the built-in data-consent API arrived later on Android. |
| Chromium-based browsers | 102 | `candifill-chromium.zip` | Uses a Chromium service-worker manifest and omits Firefox-only manifest data. |

The Chromium minimum is set to 102 because CandiFill uses `storage.session` to keep unconfirmed form answers temporarily. The release workflow removes Firefox-only manifest data and the Firefox background-script entry, leaving a Chromium service worker. This allows the package to avoid the Chrome 121 floor needed when both background entries are present. See the [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) and [cross-browser background manifest guidance](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background).

The Chromium package is suitable for Chrome, Edge, Opera, Brave, and Vivaldi at or above the minimum version. The browser APIs used by CandiFill are shared across those Chromium versions, but this project has not been manually tested in every branded browser. Job application sites also vary in their form controls, so compatibility with a specific site is not guaranteed.

The release workflow creates both archives and attaches them to GitHub Releases. To install a package manually, extract it, open the browser's extensions page, enable **Developer mode**, and choose **Load unpacked** (Chrome: `chrome://extensions`; Edge: `edge://extensions`; Opera: `opera://extensions`; Brave: `brave://extensions`; Vivaldi: `vivaldi://extensions`). Firefox's temporary add-on loader is at `about:debugging#/runtime/this-firefox`; temporary add-ons are removed when Firefox closes.

## AI data disclosures

Firefox 140+ uses Firefox's built-in consent prompt for each declared data category. In Chromium browsers, CandiFill shows an action-specific notice naming the provider and describing the text and API key that will be sent before the user starts resume analysis, text refinement, or profile tailoring. Model discovery and compatibility checks have their own notices in Settings. No AI request is made until the user clicks its action.

See Mozilla's [Firefox built-in data consent guide](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) for the category declarations and runtime permission request behavior.

These disclosures explain the current data flow; they do not guarantee marketplace approval. Review each store's current policies and privacy-form requirements when submitting.

## Store distribution

### Firefox Add-ons (AMO)

Mozilla provides free add-on hosting and update services. Submit the Firefox package through the AMO Developer Hub, provide the public privacy-policy URL, support contact, English and Portuguese listing copy, screenshots, and any source/build instructions requested by the reviewer. Mozilla may review or reject a submission. See [Mozilla's submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) and [add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/).

Mozilla's policy page announces a policy update for December 1, 2026. Re-check the current requirements if submitting on or after that date.

### Microsoft Edge Add-ons

Microsoft says there is no developer registration fee. Its current policy requires opt-in consent and a way to revoke it for sharing user data with third parties. The policy also limits third-party processors to user-facing product improvement and analytics. CandiFill sends user-selected resume or profile text to Gemini or OpenAI to produce an output for the user, so the policy's fit for this use is not clear. Do not submit to Edge Add-ons until Microsoft confirms that this provider flow is permitted and the required revocable control is in place. The Chromium package can still be loaded manually in Edge.

See Microsoft's [developer account guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/create-dev-account) and [developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies).

### Opera Add-ons

Opera publishes a review-based submission process, but its public publishing guide does not state whether developer registration or listing has a fee. Confirm the terms in the developer portal before accepting any payment. The guide also describes license terms that should be checked against this repository's MIT license before listing. See [Opera's publishing guide](https://help.opera.com/en/extensions/publishing-guidelines/) and [acceptance criteria](https://help.opera.com/en/extensions/acceptance-criteria/).

### Chrome Web Store

Publishing requires a developer account with a one-time registration fee; this project does not create the account or pay the fee. To publish manually:

1. Open the [Chrome Web Store developer registration page](https://developer.chrome.com/docs/webstore/register/), review the current fee, accept the developer terms, and enable two-step verification on the Google account.
2. From GitHub Releases, download and extract `candifill-chromium.zip` only to inspect it; upload the ZIP itself in the Chrome Web Store Developer Dashboard.
3. Complete the store listing, upload screenshots, set the privacy-policy URL, and answer the data-use disclosures to match [CandiFill's privacy policy](PRIVACY.md).
4. Submit the item for review and address any feedback from the Chrome Web Store.

Google's [disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements/) require an in-product disclosure and affirmative consent for user-data handling. CandiFill places the disclosure immediately before each user-initiated AI request. The listing and privacy declarations still need to be completed accurately in the dashboard.

## Verification performed

Automated unit tests and the strict TypeScript/production build are run by the release workflow. This does not replace loading each package in the target browser and checking autofill, answer review, PDF import, AI provider requests, and the Firefox consent prompts before submitting to a store.
