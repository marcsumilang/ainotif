# Google Play upload assets

| File | Upload slot | Required format and size |
|---|---|---|
| `app-icon-512.png` | App icon | 32-bit PNG with alpha, 512 × 512, under 1 MB |
| `feature-graphic-1024x500.jpg` | Feature graphic | JPEG, 1024 × 500, opaque |
| `screenshots/01-financial-feed.jpg` through `04-privacy-center.jpg` | Phone screenshots | Four real app captures, JPEG, 1080 × 1920, portrait 9:16 |

Editable sources are `feature-graphic-1024x500.svg` and `../../web/public/icon.svg`. `../brand/export-assets.swift` builds the upload files and Android/web raster variants. The screenshot capture checklist is in `screenshots/README.md`.

Specifications checked against [Google Play Console Help: Add preview assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-en). The four screenshots are direct captures of the app UI, populated with fictional demo data. They were captured from the debug build; confirm they match the release build before upload.
