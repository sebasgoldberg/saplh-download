Tool to download e-books from SAP Learning Hub

Requirements
============
- Node v10: https://nodejs.org/es/

Installation
============

```
git clone https://github.com/sebasgoldberg/saplh-download.git
cd saplh-download
npm i
cp config-template.js config.js
```

Configuration
=============

Edit the configuration file config.js:
- E_BOOK_NAME: The name of the e-book. For example: CLD100_EN_Col18. (this should match the name in the URL).
- E_BOOK_BASE_URL: Base e-book's URL. (example: https://saplearninghub.plateau.com/icontent_e/CUSTOM_eu/sap/self-managed/ebook/ for the CLD100_EN_Col18 e-book)
- COOKIE_SESSION: The Cookie HTTP Header value. You have to get it using for example Chrome Dev Tools.
- FROM_PAGE: From page (the first is 1)
- TO_PAGE: To page.

Usage
=====

```
node index.js
```
