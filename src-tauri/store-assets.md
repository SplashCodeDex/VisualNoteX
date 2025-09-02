# Microsoft Store Submission - Store Assets Guide

## visualNoteX - CodeDeX Drawing Application

### Icon Assets (Available in src-tauri/icons/)
- ✅ Square44x44Logo.png (44×44 - Store Logo)
- ✅ Square71x71Logo.png (71×71 - Medium Tile)
- ✅ Square150x150Logo.png (150×150 - Wide Tile)
- ✅ Square310x310Logo.png (310×310 - Large Tile)
- ✅ Square310x150Logo.png (310×150 - Large Tile)
- ✅ StoreLogo.png (Use for 50×50 Small Tile)

### Screenshots Required (Create from product_showcase/)
- Screenshot 1: Use apps/web/public/product_showcase/case-1.png (needs conversion)
- Screenshot 2: Use apps/web/public/product_showcase/case-2.png (needs conversion)
- Optional: Create additional screenshots from running application

### Package Information
- **Package ID**: visualnotex
- **Publisher**: CN=CodeDeX
- **Version**: 1.0.0.0
- **Category**: DeveloperTool

### System Requirements
- Minimum Windows version: 1903 (19H1)
- Architecture: x64
- RAM: 4GB minimum
- Storage: 200MB minimum

## Submission Steps
1. Reserve app name in Microsoft Store dashboard
2. Prepare APPX package (requires Windows SDK environment)
3. Upload package and assets
4. Complete store listing information
5. Submit for certification

## Required Capabilities
- internetClient
- documentsLibrary

## Build Commands
```bash
# MSI Build (completed)
npm run tauri:build

# APPX Build (for Store submission)
npx tauri build --target appx
