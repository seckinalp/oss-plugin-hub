$platforms = @('chrome','firefox','homeassistant','jetbrains','minecraft','obsidian','sublime','vscode','wordpress')
$totalPlugins = 0
$withRepos = 0
$withoutRepos = @()

Write-Host "Analyzing top100.json files..." -ForegroundColor Cyan
Write-Host ""

foreach($platform in $platforms) {
    $file = "data/$platform/top100.json"
    if(Test-Path $file) {
        $data = Get-Content $file -Raw | ConvertFrom-Json
        $count = $data.top100.Count
        $repoCount = ($data.top100 | Where-Object { $_.repo -and $_.repo -ne '' -and $_.repo -ne 'null' }).Count
        $missing = $count - $repoCount
        
        $totalPlugins += $count
        $withRepos += $repoCount
        
        Write-Host "$platform : $repoCount / $count have repos" -ForegroundColor $(if($missing -gt 0) {"Yellow"} else {"Green"}) -NoNewline
        if($missing -gt 0) {
            Write-Host " ($missing missing)" -ForegroundColor Red
        } else {
            Write-Host ""
        }
        
        # Collect plugins without repos
        $data.top100 | Where-Object { -not $_.repo -or $_.repo -eq '' -or $_.repo -eq 'null' } | ForEach-Object {
            $withoutRepos += [PSCustomObject]@{
                Platform = $platform
                ID = $_.id
                Name = $_.name
            }
        }
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Total plugins: $totalPlugins"
Write-Host "  With GitHub repos: $withRepos" -ForegroundColor Green
Write-Host "  Without repos: $($totalPlugins - $withRepos)" -ForegroundColor Red
Write-Host "======================================"

if($withoutRepos.Count -gt 0) {
    Write-Host ""
    Write-Host "Plugins without GitHub repos (first 20):" -ForegroundColor Yellow
    $withoutRepos | Select-Object -First 20 | Format-Table -AutoSize
    
    if($withoutRepos.Count -gt 20) {
        Write-Host "... and $($withoutRepos.Count - 20) more" -ForegroundColor Gray
    }
}














