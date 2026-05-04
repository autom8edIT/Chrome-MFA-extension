# Install-Icons.ps1 - Creates placeholder icons for Chrome extension

$sizes = @(16, 32, 48, 64, 128)
$iconDir = "$PSScriptRoot"

Write-Host "[+] Creating placeholder icons in: $iconDir" -ForegroundColor Cyan

foreach ($size in $sizes) {
    $iconPath = Join-Path $iconDir "icon$size.png"
    
    # Create a simple colored square as placeholder (base64 encoded 1x1 PNG)
    # You can replace these with actual icons later
    $base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    $bytes = [System.Convert]::FromBase64String($base64)
    
    # For now, just create empty files - you'll need to add real icons
    if (!(Test-Path $iconPath)) {
        # Create a simple text file as placeholder
        @"
This is a placeholder for icon$size.png
Please replace with actual $size x $size PNG icon
"@ | Out-File -FilePath "$iconDir\icon$size.txt" -Encoding UTF8
        
        Write-Host "  [!] Created placeholder: icon$size.txt" -ForegroundColor Yellow
        Write-Host "      Replace with real $size x $size PNG icon" -ForegroundColor Gray
    }
}

Write-Host "`n[!] IMPORTANT: Replace .txt placeholders with actual PNG icons" -ForegroundColor Yellow
Write-Host "[*] You can use any icon generator or create simple colored squares" -ForegroundColor Gray
Write-Host "[*] Extension will load without icons, but Chrome will show warnings" -ForegroundColor Gray
Write-Host "`n[+] Quick icon generation option:" -ForegroundColor Cyan
Write-Host "    Use online tool: https://www.favicon-generator.org/" -ForegroundColor Gray
Write-Host "    Or use PowerShell Add-Type System.Drawing to create simple icons" -ForegroundColor Gray
