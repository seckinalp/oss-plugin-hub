#
# OpenSSF Scorecard Docker Runner - Top100 Platforms
# Processes all repositories from data/{platform}/top100.json files
# Saves results incrementally to scorecard-local/
#

param(
    [switch]$SkipExisting,
    [switch]$Resume,
    [switch]$Force,
    [int]$Limit = 0,
    [int]$Delay = 0,
    [string]$Platform = "",
    [switch]$Help
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$DataDir = Join-Path $ProjectRoot "data"
$OutputDir = Join-Path $ProjectRoot "scorecard-local"
$LogFile = Join-Path $ProjectRoot "scorecard-scan-top100.log"
$ProgressFile = Join-Path $ProjectRoot ".scorecard-progress-top100"

# All platforms
$AllPlatforms = @(
    'chrome',
    'firefox',
    'homeassistant',
    'jetbrains',
    'minecraft',
    'obsidian',
    'sublime',
    'vscode',
    'wordpress'
)

# Counters
$Script:TotalRepos = 0
$Script:Processed = 0
$Script:Success = 0
$Script:Failed = 0
$Script:Skipped = 0
$Script:NoRepo = 0
$Script:StartTime = Get-Date

# Docker image
$ScorecardImage = "gcr.io/openssf/scorecard:stable"

function Show-Help {
    Write-Host @"
Usage: .\run-scorecard-from-top100.ps1 [OPTIONS]

Run OpenSSF Scorecard analysis on all repositories in top100.json files

Options:
  -Platform NAME   Process only specific platform (default: all)
                   Available: chrome, firefox, homeassistant, jetbrains, 
                              minecraft, obsidian, sublime, vscode, wordpress
  -SkipExisting    Skip repositories that already have output files
  -Limit N         Process only the first N repositories (across all platforms)
  -Delay N         Delay N seconds between requests (default: 0)
  -Resume          Resume from last processed repository
  -Force           Overwrite existing files
  -Help            Show this help message

Environment Variables:
  GITHUB_AUTH_TOKEN  Required. Your GitHub Personal Access Token

Examples:
  # Process first 10 repos across all platforms
  `$env:GITHUB_AUTH_TOKEN="ghp_xxx"; .\run-scorecard-from-top100.ps1 -Limit 10

  # Process only Obsidian platform
  .\run-scorecard-from-top100.ps1 -Platform obsidian

  # Resume previous run
  .\run-scorecard-from-top100.ps1 -Resume

  # Skip already processed files
  .\run-scorecard-from-top100.ps1 -SkipExisting

  # Process all ~900 repos
  .\run-scorecard-from-top100.ps1

"@
    exit 0
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $Color = switch ($Level) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    
    $Symbol = switch ($Level) {
        "SUCCESS" { "✓" }
        "ERROR" { "✗" }
        "WARNING" { "⚠" }
        "INFO" { "ℹ" }
        default { " " }
    }
    
    $LogMessage = "[$Timestamp] $Symbol $Message"
    Write-Host $LogMessage -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $LogMessage
}

function Initialize {
    Write-Log "=== OpenSSF Scorecard Runner - Top100 Platforms ===" "INFO"
    Write-Log "Project: $ProjectRoot" "INFO"
    Write-Log "Data: $DataDir" "INFO"
    Write-Log "Output: $OutputDir" "INFO"
    Write-Log "Log: $LogFile" "INFO"
    Write-Host ""

    # Check GitHub token
    if (-not $env:GITHUB_AUTH_TOKEN) {
        Write-Log "GITHUB_AUTH_TOKEN environment variable is not set" "ERROR"
        Write-Host ""
        Write-Host "Please set your GitHub token:"
        Write-Host '  $env:GITHUB_AUTH_TOKEN="ghp_your_token_here"'
        Write-Host ""
        Write-Host "Create a token at: https://github.com/settings/tokens"
        Write-Host "Required scopes: public_repo (or repo for private repos)"
        exit 1
    }

    # Create output directory
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir | Out-Null
    }

    # Check Docker
    try {
        docker version | Out-Null
    } catch {
        Write-Log "Docker is not installed or not running" "ERROR"
        exit 1
    }

    # Pull latest scorecard image
    Write-Log "Pulling latest scorecard image..." "INFO"
    try {
        docker pull $ScorecardImage 2>&1 | Out-File -Append $LogFile
        Write-Log "Scorecard image ready" "SUCCESS"
    } catch {
        Write-Log "Failed to pull latest image, will use cached version" "WARNING"
    }

    Write-Host ""
}

function Get-OutputFilename {
    param([string]$Repo)
    $Filename = $Repo -replace '/', '__'
    return Join-Path $OutputDir "$Filename.json"
}

function Test-Processed {
    param([string]$Repo)
    if (Test-Path $ProgressFile) {
        $Content = Get-Content $ProgressFile -ErrorAction SilentlyContinue
        return $Content -contains $Repo
    }
    return $false
}

function Add-Processed {
    param([string]$Repo)
    Add-Content -Path $ProgressFile -Value $Repo
}

function Normalize-RepoUrl {
    param([string]$Repo)
    
    if ([string]::IsNullOrWhiteSpace($Repo)) {
        return $null
    }
    
    # Remove common prefixes
    $Repo = $Repo -replace '^https?://github\.com/', ''
    $Repo = $Repo -replace '^github\.com/', ''
    $Repo = $Repo -replace '\.git$', ''
    
    # Extract owner/repo
    $Parts = $Repo -split '/'
    if ($Parts.Count -lt 2) {
        return $null
    }
    
    $Owner = $Parts[0].Trim()
    $Name = $Parts[1].Trim()
    
    if ([string]::IsNullOrWhiteSpace($Owner) -or [string]::IsNullOrWhiteSpace($Name)) {
        return $null
    }
    
    return "$Owner/$Name"
}

function Get-AllReposFromTop100 {
    param([string[]]$Platforms)
    
    $AllRepos = @()
    $RepoSet = @{}
    
    foreach ($PlatformName in $Platforms) {
        $Top100File = Join-Path $DataDir "$PlatformName\top100.json"
        
        if (-not (Test-Path $Top100File)) {
            Write-Log "Skipping $PlatformName - top100.json not found" "WARNING"
            continue
        }
        
        try {
            $Data = Get-Content $Top100File -Raw | ConvertFrom-Json
            $Top100 = $Data.top100
            
            if (-not $Top100) {
                Write-Log "Skipping $PlatformName - no top100 array found" "WARNING"
                continue
            }
            
            $PlatformRepoCount = 0
            foreach ($Plugin in $Top100) {
                $Repo = Normalize-RepoUrl $Plugin.repo
                if ($Repo -and -not $RepoSet.ContainsKey($Repo)) {
                    $AllRepos += @{
                        Repo = $Repo
                        Platform = $PlatformName
                        Name = $Plugin.name
                    }
                    $RepoSet[$Repo] = $true
                    $PlatformRepoCount++
                }
            }
            
            Write-Log "Found $PlatformRepoCount unique repos in $PlatformName" "INFO"
        }
        catch {
            Write-Log "Error reading $PlatformName/top100.json: $_" "ERROR"
        }
    }
    
    Write-Log "Total unique repositories across all platforms: $($AllRepos.Count)" "INFO"
    return $AllRepos
}

function Invoke-Scorecard {
    param([string]$Repo, [string]$OutputFile, [string]$PluginName)
    
    $TempFile = "$OutputFile.tmp"
    
    Write-Log "Scanning: github.com/$Repo ($PluginName)" "INFO"

    try {
        # Run Docker scorecard
        $ErrorOutput = Join-Path $env:TEMP "scorecard-error.txt"
        docker run --rm `
            -e GITHUB_AUTH_TOKEN=$env:GITHUB_AUTH_TOKEN `
            $ScorecardImage `
            --repo="github.com/$Repo" `
            --format=json `
            2> $ErrorOutput | Out-File -FilePath $TempFile -Encoding UTF8

        if ($LASTEXITCODE -eq 0 -and (Test-Path $TempFile)) {
            # Check if file has content
            $FileSize = (Get-Item $TempFile).Length
            if ($FileSize -eq 0) {
                Write-Log "Empty output for $Repo" "ERROR"
                if (Test-Path $TempFile) { Remove-Item $TempFile }
                return $false
            }
            
            # Validate JSON
            try {
                $Json = Get-Content $TempFile -Raw | ConvertFrom-Json
                Move-Item -Path $TempFile -Destination $OutputFile -Force
                $Score = if ($Json.score) { $Json.score } else { "N/A" }
                Write-Log "Saved: $(Split-Path $OutputFile -Leaf) (Score: $Score)" "SUCCESS"
                return $true
            } catch {
                Write-Log "Invalid JSON output for $Repo - $_" "ERROR"
                if (Test-Path $TempFile) { Remove-Item $TempFile }
                return $false
            }
        } else {
            $ErrorMsg = if (Test-Path $ErrorOutput) { 
                (Get-Content $ErrorOutput -Raw).Trim() 
            } else { 
                "Unknown error (exit code: $LASTEXITCODE)" 
            }
            Write-Log "Scorecard failed for $Repo - $ErrorMsg" "ERROR"
            if (Test-Path $TempFile) { Remove-Item $TempFile }
            return $false
        }
    } catch {
        Write-Log "Exception running scorecard for $Repo - $_" "ERROR"
        if (Test-Path $TempFile) { Remove-Item $TempFile }
        return $false
    }
}

function Process-AllRepos {
    param([string[]]$Platforms)
    
    # Get all repos from top100 files
    $AllRepoData = Get-AllReposFromTop100 -Platforms $Platforms
    $Script:TotalRepos = $AllRepoData.Count
    
    if ($TotalRepos -eq 0) {
        Write-Log "No repositories found to process" "WARNING"
        return
    }
    
    Write-Host ""
    Write-Log "Starting to process $TotalRepos repositories..." "INFO"
    Write-Host ""
    
    $Count = 0
    
    foreach ($RepoData in $AllRepoData) {
        $Repo = $RepoData.Repo
        $PlatformName = $RepoData.Platform
        $PluginName = $RepoData.Name
        
        $Count++
        
        # Check limit
        if ($Limit -gt 0 -and $Count -gt $Limit) {
            Write-Log "Reached limit of $Limit repositories" "INFO"
            break
        }
        
        # Resume logic
        if ($Resume -and (Test-Processed $Repo)) {
            Write-Log "Skipping (already processed): $Repo" "INFO"
            $Script:Skipped++
            continue
        }
        
        $OutputFile = Get-OutputFilename $Repo
        
        # Skip existing files if requested
        if ($SkipExisting -and -not $Force -and (Test-Path $OutputFile)) {
            try {
                $Content = Get-Content $OutputFile -Raw | ConvertFrom-Json
                if ($Content.score -or $Content.repo) {
                    Write-Log "Skipping (file exists): $Repo" "INFO"
                    $Script:Skipped++
                    Add-Processed $Repo
                    continue
                }
            } catch {
                # Invalid file, will re-process
                Write-Log "Re-processing invalid file for: $Repo" "WARNING"
            }
        }
        
        # Progress indicator
        Write-Host ""
        $PercentComplete = [math]::Round(($Count / $TotalRepos) * 100, 1)
        Write-Log "Progress: $Count/$TotalRepos ($PercentComplete%) - Success: $Success, Failed: $Failed, Skipped: $Skipped" "INFO"
        
        # Run scorecard
        if (Invoke-Scorecard $Repo $OutputFile $PluginName) {
            $Script:Success++
            Add-Processed $Repo
        } else {
            $Script:Failed++
            Add-Processed $Repo
        }
        
        $Script:Processed++
        
        # Rate limiting
        if ($Delay -gt 0 -and $Count -lt $TotalRepos) {
            Start-Sleep -Seconds $Delay
        }
    }
}

function Show-Summary {
    $EndTime = Get-Date
    $Duration = $EndTime - $Script:StartTime
    
    Write-Host ""
    Write-Host "========================================"
    Write-Log "=== Summary ===" "INFO"
    Write-Host "========================================"
    Write-Log "Total repositories: $TotalRepos" "INFO"
    Write-Log "Processed: $Processed" "INFO"
    Write-Log "Successful: $Success" "SUCCESS"
    Write-Log "Failed: $Failed" "ERROR"
    Write-Log "Skipped: $Skipped" "WARNING"
    
    if ($Success -gt 0) {
        $SuccessRate = [math]::Round(($Success / $Processed) * 100, 1)
        Write-Log "Success rate: $SuccessRate%" "INFO"
    }
    
    Write-Log "Duration: $($Duration.ToString('hh\:mm\:ss'))" "INFO"
    
    # Calculate average time per repo
    if ($Processed -gt 0) {
        $AvgSeconds = [math]::Round($Duration.TotalSeconds / $Processed, 1)
        Write-Log "Average time per repo: ${AvgSeconds}s" "INFO"
    }
    
    # Estimate remaining time
    if ($Limit -eq 0 -and $Processed -lt $TotalRepos) {
        $Remaining = $TotalRepos - $Processed
        $EstSeconds = $AvgSeconds * $Remaining
        $EstTime = [TimeSpan]::FromSeconds($EstSeconds)
        Write-Log "Estimated time remaining: $($EstTime.ToString('hh\:mm\:ss'))" "WARNING"
    }
    
    Write-Host "========================================"
    Write-Host ""
    
    Write-Log "Output directory: $OutputDir" "INFO"
    Write-Log "Log file: $LogFile" "INFO"
    Write-Log "Progress file: $ProgressFile" "INFO"
    
    if ($Success -gt 0) {
        Write-Host ""
        Write-Log "Next steps:" "SUCCESS"
        Write-Host "  1. Review results in: $OutputDir"
        Write-Host "  2. Import into your system:"
        Write-Host "     node scripts/fetch-openssf-scorecard.js --import-dir=./scorecard-local"
    }
    
    if ($Processed -lt $TotalRepos) {
        Write-Host ""
        Write-Log "To resume processing remaining repos:" "INFO"
        Write-Host "     .\scripts\run-scorecard-from-top100.ps1 -Resume"
    }
    
    Write-Host ""
}

# Main execution
if ($Help) {
    Show-Help
}

try {
    Initialize
    
    # Determine platforms to process
    $PlatformsToProcess = if ($Platform) {
        if ($AllPlatforms -contains $Platform) {
            @($Platform)
        } else {
            Write-Log "Invalid platform: $Platform" "ERROR"
            Write-Log "Available platforms: $($AllPlatforms -join ', ')" "INFO"
            exit 1
        }
    } else {
        $AllPlatforms
    }
    
    Write-Log "Platforms to process: $($PlatformsToProcess -join ', ')" "INFO"
    Write-Log "Delay between requests: ${Delay}s" "INFO"
    
    if ($SkipExisting) {
        Write-Log "Mode: Skip existing files" "INFO"
    }
    
    if ($Resume) {
        Write-Log "Mode: Resume from previous run" "INFO"
    }
    
    if ($Limit -gt 0) {
        Write-Log "Limit: Processing first $Limit repositories" "INFO"
    }
    
    Write-Host ""
    
    Process-AllRepos -Platforms $PlatformsToProcess
    Show-Summary
    
} catch {
    Write-Log "Fatal error: $_" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    Show-Summary
    exit 1
}














