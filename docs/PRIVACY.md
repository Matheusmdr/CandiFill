# CandiFill Privacy Policy

**Last updated:** November 5, 2026

This policy describes how the initial release of CandiFill handles data. It should be reviewed whenever the product or its providers change.

## Data stored in your browser

CandiFill stores the information you enter or import into your vault in the extension's local browser storage. This may include contact details, work experience, education, reusable answers, your resume, and the API key you configure. CandiFill does not send this profile to its own server.

When a compatible form field was empty and you enter an eligible answer, the extension may create a suggestion for you to review. To keep it available after the form navigates, the suggestion is stored temporarily in the extension session, associated with the tab and domain, for up to 15 minutes. It is only written to your profile after you select **Save**. Dismissing the review removes the suggestion. Automatic filters may miss sensitive information, so review each question and answer before saving.

The JSON backup is created locally for you to download. It may contain your profile, saved answers, and attached resume, but it excludes your API key.

## Data sent to AI providers

CandiFill does not run its own AI server. If you configure an API key and use an AI feature, the text needed for that action is sent from your browser directly to the provider you selected:

- **Google Gemini:** resume text during extraction, or the professional text you selected for refinement.
- **OpenAI:** resume text during extraction, or the professional text you selected for refinement.

The provider also receives the API key needed to authenticate the request. CandiFill does not send this text to providers until you use an AI feature. Further handling is governed by the selected provider's terms and privacy policy.

## Data from job application pages

The content script can be loaded on webpages to enable form filling. Passive answer capture is armed only on pages with job application signals; you can also arm it by using CandiFill manually. The script identifies form fields and may read an eligible answer you typed to create a local suggestion. CandiFill does not submit forms automatically or send page values to its own server. Values identified as sensitive are excluded, but the filter may miss some; review suggestions carefully. The extension primarily works with `input`, `textarea`, and `select` fields; special controls may not be processed.

## Sharing and analytics

This release does not include user accounts, a profile server, ads, or analytics. Data stays in your browser except for text and API keys sent directly to your selected provider when you use an AI feature.

## Deletion and copies

You can remove saved answers from the vault and dismiss suggestions that have not been confirmed. Downloaded backups are under your control and must be deleted by you. The extension does not receive a copy of a backup.

## Contact

**Support and privacy contact:** [matheusmdr@hotmail.com](mailto:matheusmdr@hotmail.com).
