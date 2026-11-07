# CandiFill Privacy Policy

**Last updated:** November 5, 2026

This policy describes how the initial release of CandiFill handles data. It should be reviewed whenever the product or its providers change.

## Data stored in your browser

CandiFill stores the information you enter or import into your vault in the extension's local browser storage. You can keep multiple application profiles. Contact details, education, AI settings, and theme are shared across profiles; summaries, work experience, salary preferences, custom fields, saved answers, and resumes belong to each profile. The vault also stores the API key you configure. Application records (company, role, link, dates, stage, notes, and profile used) and field mappings (site domain, field locator, and chosen profile field) are stored locally too. A field mapping stores no value entered on the job site. CandiFill does not send your profiles to its own server.

Your interface language preference is also stored locally in the extension.

When a compatible form field was empty and you enter an eligible answer, the extension may create a suggestion for you to review. To keep it available after the form navigates, the suggestion is stored temporarily in the extension session, associated with the tab and domain, for up to 15 minutes. It is only written to your profile after you select **Save**. Dismissing the review removes the suggestion. Automatic filters may miss sensitive information, so review each question and answer before saving.

The JSON backup is created locally for you to download. It may contain all profiles, saved answers, attached resumes, application records, and site field mappings, but it excludes API keys.

## Data sent to AI providers

CandiFill does not run its own AI server. If you configure an API key and use an AI feature, the text needed for that action is sent from your browser directly to the provider you selected:

- **Google Gemini:** resume text during extraction, or the professional text you selected for refinement.
- **OpenAI:** resume text during extraction, or the professional text you selected for refinement.

When you create a profile tailored to a job description, CandiFill sends the job description, target role, and the active profile's headline, summaries, and work history to the selected provider. It does not include contact details, education, saved answers, or the attached resume in this request. The result is shown as an editable draft for you to review before saving.

When you ask CandiFill to find available models, it sends your API key to the selected provider to retrieve the models accessible to that key; no profile or job application text is included in this lookup. If you choose **Test compatibility**, CandiFill sends a short test prompt to the selected model. The provider may count this request toward your usage or charges.

The provider also receives the API key needed to authenticate the request. Before each AI action, CandiFill identifies the text and API key that will be sent and names the provider; the request is sent only after you click that action. On Firefox desktop 140+ and Firefox Android 142+, Firefox also asks for data-sharing consent before the first request for each relevant data category. If you decline, that request is not sent and local features remain available. Further handling is governed by the selected provider's terms and privacy policy.

## Data from job application pages

The content script is injected into the active webpage only after you invoke CandiFill or its keyboard shortcut. Passive answer capture is armed only on pages with job application signals; you can also arm it by using CandiFill manually. The script identifies form fields and may read an eligible answer you typed to create a local suggestion. When you manually map a site field, the selected profile value is used to create a local rule for that site's domain and field locator; the rule does not store the value typed into the page. CandiFill does not submit forms automatically or send page values to its own server. Values identified as sensitive are excluded, but the filter may miss some; review suggestions carefully. The extension primarily works with `input`, `textarea`, and `select` fields; special controls may not be processed.

## Sharing and analytics

This release does not include user accounts, a profile server, ads, or analytics. Data stays in your browser except for text and API keys sent directly to your selected provider when you use an AI feature.

## Deletion and copies

You can remove saved answers from the vault and dismiss suggestions that have not been confirmed. Downloaded backups are under your control and must be deleted by you. The extension does not receive a copy of a backup.

## Contact

**Support and privacy contact:** [matheusmdr@hotmail.com](mailto:matheusmdr@hotmail.com).
