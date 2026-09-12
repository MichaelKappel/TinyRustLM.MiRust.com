# Canonical validation only. Publishing and credential/transport options are retired.
param(
    [string]$ManifestPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "deploy\site-deployment-manifest.v1.json"),
    [string]$NodeExecutablePath = $env:TINYRUSTLM_NODE_EXECUTABLE,
    [switch]$Publish
)
$ErrorActionPreference = "Stop"
if ($Publish) { throw "Legacy full-site publishing is disabled. Complete the hardened source-retirement transaction before any separately reviewed publisher is introduced." }
$repositoryRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$script:verifiedNodeExecutablePath = $null
$expectedNodeExecutableBytes = [int64]91380224
$expectedNodeExecutableSha256 = "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088"

function Get-IdentityFileSha256 {
    param([Parameter(Mandatory)][string]$Path)

    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace("-", "").ToLowerInvariant() }
    finally { $sha.Dispose(); $stream.Dispose() }
}

function Assert-CanonicalSourceAuthority {
    if ([string]::IsNullOrWhiteSpace($NodeExecutablePath) -or -not [IO.Path]::IsPathRooted($NodeExecutablePath)) {
        throw "Source-authority verification requires an explicit absolute Node executable path."
    }
    $resolvedNode = [IO.Path]::GetFullPath($NodeExecutablePath)
    $nodeItem = Get-Item -LiteralPath $resolvedNode -Force
    if ($nodeItem.PSIsContainer -or
        ($nodeItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $nodeItem.Length -ne $expectedNodeExecutableBytes -or
        (Get-IdentityFileSha256 -Path $nodeItem.FullName) -cne $expectedNodeExecutableSha256) {
        throw "Source-authority Node runtime does not match its immutable expected identity."
    }
    $preflightPath = Join-Path $PSScriptRoot "source-authority-preflight.js"
    $preflightItem = Get-Item -LiteralPath $preflightPath -Force
    if ($preflightItem.PSIsContainer -or
        ($preflightItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $preflightItem.Length -lt 1 -or $preflightItem.Length -gt 1048576) {
        throw "Local source-authority preflight is unavailable."
    }

    $savedErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $gateOutput = @(& $resolvedNode $preflightItem.FullName 2>&1)
        $gateExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $savedErrorActionPreference
    }
    $gateOutputText = [string]::Join("`n", @($gateOutput | ForEach-Object { [string]$_ }))
    if ($gateOutputText.Length -gt 65536 -or $gateExitCode -ne 0 -or $gateOutput.Count -lt 1) {
        throw "Canonical source-authority gate failed closed."
    }
    if ([string]$gateOutput[-1] -cne "SOURCE_AUTHORITY_VALID") {
        throw "Canonical source-authority preflight returned no exact success marker."
    }
    $script:verifiedNodeExecutablePath = $resolvedNode
}


# Keep Node startup injection disabled for both preflight and validation.
$hadNodeOptions = Test-Path Env:NODE_OPTIONS
$savedNodeOptions = if ($hadNodeOptions) { $env:NODE_OPTIONS } else { $null }
$hadNodePath = Test-Path Env:NODE_PATH
$savedNodePath = if ($hadNodePath) { $env:NODE_PATH } else { $null }
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
Remove-Item Env:NODE_PATH -ErrorAction SilentlyContinue
try {
    Assert-CanonicalSourceAuthority
    $canonicalManifest = Join-Path $repositoryRoot "deploy\site-deployment-manifest.v1.json"
    $resolvedManifestPath = [IO.Path]::GetFullPath($ManifestPath)
    if (-not [string]::Equals($resolvedManifestPath, $canonicalManifest, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Validation requires the canonical repository manifest path."
    }
    $manifestItem = Get-Item -LiteralPath $resolvedManifestPath -Force
    if ($manifestItem.PSIsContainer -or ($manifestItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $manifestItem.Length -lt 1 -or $manifestItem.Length -gt 2097152) { throw "Manifest must be one bounded regular file." }
    $validator = Join-Path $PSScriptRoot "verify-site-deployment-input.js"
    & $script:verifiedNodeExecutablePath $validator $resolvedManifestPath
    if ($LASTEXITCODE -ne 0) { throw "Canonical public-file validation failed." }
    Write-Output "VALIDATION_ONLY: no local stage, credentials, receipt or transport was created."
}
finally {
    if ($hadNodeOptions) { Set-Item Env:NODE_OPTIONS $savedNodeOptions }
    if ($hadNodePath) { Set-Item Env:NODE_PATH $savedNodePath }
}
