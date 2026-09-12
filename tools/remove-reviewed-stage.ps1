# Owner-run retirement of the exact reviewed stage; -WhatIf checks without mutation.
[CmdletBinding(SupportsShouldProcess = $true)]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = 'E:\Source\Rust\TinyRustLM.MiRust.com'
$target = Join-Path $root 'deploy\staging\1.8.3'
$recordRoot = Join-Path $root 'artifacts\ecosystem-cleanup-20260912'
$reviewPath = Join-Path $recordRoot 'stale-1.8.3-stage-review.json'
$receiptPath = Join-Path $recordRoot 'stale-1.8.3-stage-retirement-receipt.json'
$reviewHash = 'ce5b7b5b7cc2eb20a0c36ea94087ddc8eddcded21ef4b8a90ee7fd12bcdb8c03'

# Check every existing ancestor before enumeration or deletion.
function Assert-OrdinaryDirectory([string]$Path) {
    $cursor = Get-Item -LiteralPath $Path -Force
    while ($null -ne $cursor) {
        if ($cursor -isnot [IO.DirectoryInfo] -or ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Linked or invalid retirement ancestry.'
        }
        $cursor = $cursor.Parent
    }
}

if ([IO.Path]::GetFullPath($PSScriptRoot) -cne (Join-Path $root 'tools') -or
    [IO.Path]::GetFullPath($target) -cne 'E:\Source\Rust\TinyRustLM.MiRust.com\deploy\staging\1.8.3' -or
    -not $target.StartsWith($root + '\', [StringComparison]::Ordinal)) { throw 'Noncanonical retirement path.' }
Assert-OrdinaryDirectory $recordRoot
Assert-OrdinaryDirectory (Split-Path -Parent $target)
$reviewItem = Get-Item -LiteralPath $reviewPath -Force
if ($reviewItem.PSIsContainer -or ($reviewItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
    $reviewItem.Length -gt 65536 -or
    (Get-FileHash -LiteralPath $reviewPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $reviewHash) {
    throw 'Retirement review identity changed.'
}
$review = Get-Content -LiteralPath $reviewPath -Raw | ConvertFrom-Json
if ($review.root -cne $target -or $review.files.Count -ne 27 -or
    $review.retainedGitCommit -cne '24e4f875a0e508827e6ddf6f94664e927261fbd5') { throw 'Review scope changed.' }
if (-not (Test-Path -LiteralPath $target)) { Write-Output 'Reviewed portal stage already absent.'; return }
if (Test-Path -LiteralPath $receiptPath) { throw 'Receipt already exists while stage remains.' }
Assert-OrdinaryDirectory $target

# Enumerate only ordinary children, with bounds, before following any directory.
$pending = [Collections.Generic.Queue[string]]::new()
$pending.Enqueue($target)
$files = [Collections.Generic.List[IO.FileInfo]]::new()
$count = 0
while ($pending.Count) {
    $directory = $pending.Dequeue()
    foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
        if (++$count -gt 128 -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            -not $item.FullName.StartsWith($target + '\', [StringComparison]::Ordinal)) { throw 'Unsafe stage member.' }
        if ($item.PSIsContainer) { $pending.Enqueue($item.FullName) }
        else { $files.Add($item) }
    }
}
if ($files.Count -ne 27) { throw 'Stage file count changed.' }
$total = [int64]0
foreach ($file in $files) {
    $relative = $file.FullName.Substring($target.Length + 1).Replace('\', '/')
    $expected = @($review.files | Where-Object { $_.relativePath -ceq $relative })
    if ($expected.Count -ne 1 -or $file.Length -ne $expected[0].byteLength -or
        (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected[0].sha256) {
        throw 'Stage bytes changed; review is required.'
    }
    # Git must still retain exactly these bytes before a redundant file is removed.
    $blob = & git -c safe.directory=E:/Source/Rust/TinyRustLM.MiRust.com -C $root rev-parse ($review.retainedGitCommit + ':' + $relative)
    if ($LASTEXITCODE -ne 0) { throw 'Retained Git object is unavailable.' }
    $actual = & git -c safe.directory=E:/Source/Rust/TinyRustLM.MiRust.com -C $root hash-object --no-filters -- $file.FullName
    if ($LASTEXITCODE -ne 0 -or $actual -cne $blob) { throw 'Retained Git bytes differ from the reviewed stage.' }
    $total += $file.Length
}
if ($total -ne 136632) { throw 'Stage size changed.' }
if ($PSCmdlet.ShouldProcess($target, 'Delete 27 reviewed historical copies (136,632 logical bytes)')) {
    $before = [IO.DriveInfo]::new('E:\').AvailableFreeSpace
    Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
    if (Test-Path -LiteralPath $target) { throw 'Portal stage retirement incomplete.' }
    $after = [IO.DriveInfo]::new('E:\').AvailableFreeSpace
    $receipt = [ordered]@{
        schema = 'tinyrustlm-mirust.stage-retirement-receipt/1'
        completedUtc = [DateTime]::UtcNow.ToString('o'); root = $target
        reviewSha256 = $reviewHash; deletedFiles = 27; logicalBytes = $total; targetAbsent = $true
        volumeAvailableBefore = $before; volumeAvailableAfter = $after; volumeDeltaBytes = $after - $before
        measurementLimit = 'Volume free space also changes with concurrent activity.'
    }
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($receipt | ConvertTo-Json) + "`n")
    $stream = [IO.File]::Open($receiptPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) }
    finally { $stream.Dispose() }
    Write-Output 'Reviewed portal stage removed; receipt recorded.'
}
