---
'@brumate/ui': minor
---

The date parts speak the language of the I18nProvider. The placeholders of the segments follow what browsers show in their date inputs (`tt.mm.jjjj` in German), the segment names come from `Intl.DisplayNames`, and the labels of the Calendar and the DatePicker have a table for English, German, French, Spanish, Japanese and Chinese. An I18nProvider takes `strings` to replace the whole set, and `timeZone`. The server writes only the strings of its language into the page. Today follows `timeZone` of the Calendar or the I18nProvider: the server renders its date, then the browser takes its own and updates it when the tab shows and at midnight.
