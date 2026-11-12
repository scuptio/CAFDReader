# Implementation compatibility

> English | [简体中文](../zh-CN/compatibility.md)

CAFD Reader product version 0.1.0, program cafd-reader, library cafd_reader_lib. The application identifier `org.caf.reader`, the cafbook/cafcover URI schemes, and the caf-app root-hash storage key stay stable so existing bookshelves carry over.

The system associates only .cafd; manual selection and the desktop command line also accept .caf. Legacy data profiles are metadata-only in the browser; the native bookshelf accepts only documents containing a valid built-in app. New files are stored as hash.cafd, reading falls back to legacy hash.caf, and de-duplication and personal records keep the original hash. Browser localStorage and the native private directory are kept separate and never mixed.

"Remove from shelf" on the home page only changes the display index: the browser stores the hidden file name locally, and natively only the bookshelf metadata index is removed. Document files, original imported files, covers, and personal records are kept. The removed state persists across refresh and restart; re-importing the same document natively restores its display and its existing personal records.

This repository contains no book content, no editing pipeline, and no in-book layout application; builds and tests use only this repository's sources and standalone fixtures. Document producers integrate solely through the specification and the generated web release artifacts.
