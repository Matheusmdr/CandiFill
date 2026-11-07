# CandiFill

CandiFill is a Firefox extension that helps you fill out job applications using your saved professional profile and reusable answers. Your profile stays in the browser, and you review new answers before saving them.

> **Project status:** GitHub builds are available. The Firefox Add-ons installation link will be added after Mozilla approves the listing. Until then, download the prebuilt package or follow the source installation steps below.

## Features

- Fill compatible application fields without replacing information you have already entered or submitting forms for you.
- Review answers you enter in application forms and choose which ones to save for reuse.
- Search saved answers and organize them by category and application site.
- Map an unrecognized field to a profile value and reuse that site-specific rule locally.
- Track application stages, dates, notes, links, and the profile used.
- Review profile consistency warnings and field-level compatibility diagnostics.
- Keep shared contact details and education alongside separate role-specific summaries, work history, answers, salary preferences, and resumes in local application profiles.
- Switch between profiles for different roles, create a blank profile, or duplicate an existing one. You can also draft a profile tailored to a job description, review and edit the suggestions, then save it.
- Use the interface in English or Brazilian Portuguese. The browser language is selected automatically, and you can change it in Settings.
- Import resume details from a PDF, refine text, or tailor a profile to a job description with your own Google Gemini or OpenAI API key. Text used for each action is sent directly to the provider you choose.
- Export and restore profiles, application records, and site mappings as JSON. API keys are excluded from backups.

Read the [Privacy Policy in English](docs/PRIVACY.md) or [Portuguese](docs/PRIVACIDADE.md) before using the extension.

## Install a prebuilt package

Download and extract the package for your browser:

- [Firefox package](https://github.com/Matheusmdr/CandiFill/releases/latest/download/candifill-firefox.zip): open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `manifest.json` from the extracted folder. Firefox removes temporary add-ons when it closes. Permanent installation will be available after the Firefox Add-ons listing is approved.
- [Chromium package](https://github.com/Matheusmdr/CandiFill/releases/latest/download/candifill-chromium.zip): open the browser's extensions page, enable **Developer mode**, select **Load unpacked**, and choose the extracted package folder. Use it for Chrome, Edge, Opera, Brave, and Vivaldi.

The GitHub release workflow builds separate Firefox and Chromium packages. The Chromium package has its own Manifest V3 service-worker manifest; the Firefox data-consent metadata is only included in the Firefox package.

Releases before `v1.0.3` contain only the Firefox package. For future releases, update the version in `public/manifest.json`, `package.json`, and `package-lock.json`, then push a matching `vX.Y.Z` tag. GitHub Actions will run tests, build both browser packages, and attach them to the release.

## Install from source

Permanent installation through **Firefox Add-ons (AMO)** is pending review. Until then, you can load a temporary build from source. Firefox removes temporary add-ons when it closes.

If you used an earlier development build, export your profile as JSON before installing this version, then import that file into CandiFill. This release uses a new extension identity and therefore has separate Firefox storage.

Requirements: Firefox 140 or later, Node.js 22.12 or later, and npm.

1. Download this repository as a ZIP and extract it, or clone it with Git.
2. Open a terminal in the project folder and install dependencies:

   ```bash
   npm ci
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. In Firefox, open `about:debugging#/runtime/this-firefox`.
5. Select **Load Temporary Add-on…** and choose `dist/manifest.json`.

On Windows PowerShell, if the execution policy blocks `npm.ps1`, run `npm.cmd ci` and `npm.cmd run build` instead.

## Development

```bash
npm ci
npm test
npm run build
```

- `src/` contains the React application, content script, background script, and services.
- `public/` contains the extension manifest and icons.
- `docs/` contains the privacy policies in English and Portuguese.

`dist/` is generated build output. Edit the source files instead.

## Browser support

- **Firefox desktop 140 and later.** Firefox Android requires 142 or later.
- **Chromium-based browsers 102 and later**, including Chrome, Edge, Opera, Brave, and Vivaldi.

The browser APIs and release packages are prepared for these versions, but branded browsers and individual job application sites have not all been manually verified. CandiFill does not claim universal support for every application form. See [browser compatibility and publishing notes](docs/BROWSER-COMPATIBILITY.md) for known store-specific limitations.

## Privacy and permissions

- Your profiles, resumes, application records, and site mappings are stored in the extension's local browser storage. Contact details, education, AI settings, and theme are shared across profiles; role-specific information stays with each profile. A site mapping stores the domain and field locator but not the value typed into the page.
- Answers waiting for your review are kept in the extension session, associated with the tab and site, for up to 15 minutes. They are not added to your profile unless you confirm.
- Firefox asks for data-sharing consent before the first AI request for each data category. Before each AI action in other browsers, CandiFill identifies the text and API key that will be sent; nothing is sent until you click the action button. Declining Firefox's request leaves local autofill and other local features available.
- AI features send the text needed for the requested action directly to your selected provider (Gemini or OpenAI). Tailoring a profile sends the job description and the active profile's professional summaries and work history; it does not send contact details, the attached resume, or saved answers. Model discovery sends your API key to the provider; checking a selected model sends a short test prompt and may incur usage charges. CandiFill does not run its own AI server.
- CandiFill injects its content script into the active page only after you invoke the extension or keyboard shortcut. Passive answer capture is limited to pages recognized as job applications. See the [Privacy Policy](docs/PRIVACIDADE.md) for details and limitations.

## Issues and support

Report bugs through this repository's **Issues** tab. Do not include resumes, API keys, form answers, or other personal information in public issues. For support or to report a security issue privately, email [matheusmdr@hotmail.com](mailto:matheusmdr@hotmail.com).

## License

CandiFill is distributed under the MIT License. See [LICENSE](LICENSE).
