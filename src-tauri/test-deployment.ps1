# visualNoteX Deployment Test Script
# Test both MSI and APPX package deployment

Write-Host "=== visualNoteX Deployment Test Script ===" -ForegroundColor Green
Write-Host "CodeDeX - Professional Drawing Application" -ForegroundColor Cyan
Write-Host ""

# Function to get file size
function Get-FileSize {
    param([string]$filePath)

    if (Test-Path $filePath) {
        $fileSize = (Get-Item $filePath).Length
        if ($fileSize -gt 1MB) {
            return "{0:N2} MB" -f ($fileSize / 1MB)
        } else {
            return "{0:N0} KB" -f ($fileSize / 1KB)
        }
    } else {
        return "N/A"
    }
}

# Test MSI Package
$msiPath = Join-Path $PSScriptRoot "target\release\bundle\msi\visualNoteX_1.0.0_x64_en-US.msi"

Write-Host "1. MSI Package Test:" -ForegroundColor Yellow
if (Test-Path $msiPath) {
    Write-Host "   ✓ MSI package found: $msiPath" -ForegroundColor Green
    Write-Host "   ✓ File size: $(Get-FileSize $msiPath)" -ForegroundColor Green

    # Get MSI information (basic validation)
    try {
        $productName = Get-AppLockerFileInformation -Path $msiPath | Select-Object -ExpandProperty ProductName
        Write-Host "   ✓ Product Name: $productName" -ForegroundColor Green
    } catch {
        Write-Host "   ! Could not extract product info from MSI" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✗ MSI package not found" -ForegroundColor Red
}

Write-Host ""

# Check for APPX Package
$appxPath = Join-Path $PSScriptRoot "target\release\bundle\appx"

Write-Host "2. APPX Package Check:" -ForegroundColor Yellow
if (Test-Path $appxPath) {
    Write-Host "   ✓ APPX bundle directory found" -ForegroundColor Green

    $appxFiles = Get-ChildItem -Path $appxPath -Filter "*.appx" -ErrorAction SilentlyContinue

    if ($appxFiles) {
        foreach ($file in $appxFiles) {
            Write-Host "   ✓ APPX package found: $($file.Name)" -ForegroundColor Green
            Write-Host "   ✓ File size: $(Get-FileSize $file.FullName)" -ForegroundColor Green
        }
    } else {
        Write-Host "   ! No APPX files found in bundle directory" -ForegroundColor Yellow
        Write-Host "   Note: APPX build may require Windows Development Kit" -ForegroundColor Cyan
    }
} else {
    Write-Host "   ! APPX bundle directory not found" -ForegroundColor Yellow
    Write-Host "   Note: Run 'npx tauri build --target appx' to create APPX for Microsoft Store" -ForegroundColor Cyan
}

Write-Host ""

# Check Icons and Assets
Write-Host "3. Store Assets Check:" -ForegroundColor Yellow
$iconsPath = Join-Path $PSScriptRoot "icons"

if (Test-Path $iconsPath) {
    $requiredIcons = @(
        "Square44x44Logo.png",
        "Square71x71Logo.png",
        "Square150x150Logo.png",
        "Square310x310Logo.png",
        "StoreLogo.png"
    )

    $available = 0
    foreach ($icon in $requiredIcons) {
        $iconPath = Join-Path $iconsPath $icon
        if (Test-Path $iconPath) {
            $available++
        } else {
            Write-Host "   ✗ Missing icon: $icon" -ForegroundColor Red
        }
    }

    Write-Host "   ✓ $available/$($requiredIcons.Count) required icons found" -ForegroundColor Green
} else {
    Write-Host "   ✗ Icons directory not found" -ForegroundColor Red
}

Write-Host ""

# Configuration Check
Write-Host "4. Configuration Validation:" -ForegroundColor Yellow
$tauriConfPath = Join-Path $PSScriptRoot "tauri.conf.json"

if (Test-Path $tauriConfPath) {
    try {
        $config = Get-Content $tauriConfPath | ConvertFrom-Json
        Write-Host "   ✓ Tauri configuration found" -ForegroundColor Green
        Write-Host "   ✓ Product Name: $($config.productName)" -ForegroundColor Green
        Write-Host "   ✓ Version: $($config.version)" -ForegroundColor Green
        Write-Host "   ✓ Publisher: $($config.bundle.publisherDisplayName)" -ForegroundColor Green

        if ($config.bundle.targets -contains "appx") {
            Write-Host "   ✓ APPX target configured" -ForegroundColor Green
        } else {
            Write-Host "   ! APPX target not configured" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ✗ Invalid Tauri configuration" -ForegroundColor Red
    }
} else {
    Write-Host "   ✗ Tauri configuration not found" -ForegroundColor Red
}

Write-Host ""

# Certification Notes
Write-Host "5. Certification Notes:" -ForegroundColor Yellow
Write-Host "   • MSI package ready for Windows deployment" -ForegroundColor Cyan
Write-Host "   • APPX package required for Microsoft Store submission" -ForegroundColor Cyan
Write-Host "   • Ensure proper code signing certificate for production" -ForegroundColor Cyan
Write-Host "   • Test installation on clean Windows environment" -ForegroundColor Cyan
Write-Host "   • Verify application functionality after installation" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== Test Completed ===" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test MSI installation on target systems" -ForegroundColor White
Write-Host "2. Build APPX for Microsoft Store submission" -ForegroundColor White
Write-Host "3. Create store listing with proper assets" -ForegroundColor White
Write-Host "4. Submit to Microsoft Store for certification" -ForegroundColor White
