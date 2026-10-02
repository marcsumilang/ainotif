# Google Play upload assets

| File | Upload slot | Required format and size |
|---|---|---|
| `app-icon-512.png` | App icon | 32-bit PNG with alpha, 512 × 512, under 1 MB |
| `feature-graphic-1024x500.jpg` | Feature graphic | JPEG, 1024 × 500, opaque |
| `screenshots/` | Phone screenshots | Four real app captures recommended for recommendation eligibility; portrait 1080 × 1920 or higher |

Editable sources are `feature-graphic-1024x500.svg` and `../../web/public/icon.svg`. `../brand/export-assets.swift` builds the upload files and Android/web raster variants. The screenshot capture checklist is in `screenshots/README.md`.

Specifications checked against [Google Play Console Help: Add preview assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-en). Screenshots must show the actual app. There is no Android device screenshot in this workspace yet, so no illustrative mockup has been presented as a store screenshot.
