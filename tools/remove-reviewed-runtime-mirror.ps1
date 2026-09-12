# Owner-run removal of the exact historical mirror; -WhatIf validates without mutation.
[CmdletBinding(SupportsShouldProcess = $true)]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repository = 'E:\Source\Rust\TinyRustLM.MiRust.com'
$root = Join-Path $repository 'docs\runtime-portal'
$records = Join-Path $repository 'artifacts\ecosystem-cleanup-20260912'
$reviewPath = Join-Path $records 'historical-runtime-retirement-review.json'
$receiptPath = Join-Path $records 'historical-runtime-retirement-receipt.json'
$reviewHash = 'c0555bc18fde0b9232811444b45b8332d07fddf2d7efec57b8f024468b212108'

# Walk existing ancestry before reading or removing any reviewed member.
function Assert-PlainDirectory([string]$Path) {
    $cursor = Get-Item -LiteralPath $Path -Force
    while ($null -ne $cursor) {
        if ($cursor -isnot [IO.DirectoryInfo] -or ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Linked or invalid retirement ancestry.'
        }
        $cursor = $cursor.Parent
    }
}

if ([IO.Path]::GetFullPath($PSScriptRoot) -cne (Join-Path $repository 'tools') -or
    [IO.Path]::GetFullPath($root) -cne 'E:\Source\Rust\TinyRustLM.MiRust.com\docs\runtime-portal') {
    throw 'Use the canonical retirement script only.'
}
Assert-PlainDirectory $records
Assert-PlainDirectory $root
$item = Get-Item -LiteralPath $reviewPath -Force
if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
    $item.Length -gt 262144 -or
    (Get-FileHash -LiteralPath $reviewPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $reviewHash) {
    throw 'Retirement review identity changed.'
}
$review = Get-Content -LiteralPath $reviewPath -Raw | ConvertFrom-Json
if ($review.root -cne $root -or $review.files.Count -ne 184 -or $review.logicalBytes -ne 1963723) {
    throw 'Retirement review scope changed.'
}
& git -c safe.directory=E:/Source/Rust/TinyRustLM.MiRust.com -C $repository cat-file -e ($review.retainedGitCommit + '^{commit}')
if ($LASTEXITCODE -ne 0) { throw 'Retained historical commit is unavailable.' }
# Enumerate without following links, so a dangling link cannot masquerade as absence.
$present = [Collections.Generic.Dictionary[string,IO.FileInfo]]::new([StringComparer]::Ordinal)
$pending = [Collections.Generic.Queue[string]]::new()
$pending.Enqueue($root)
$count = 0
while ($pending.Count) {
    foreach ($member in Get-ChildItem -LiteralPath $pending.Dequeue() -Force) {
        if (++$count -gt 1024 -or ($member.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Unsafe or oversized mirror tree.'
        }
        if ($member.PSIsContainer) { $pending.Enqueue($member.FullName) }
        else { $present.Add($member.FullName, $member) }
    }
}
$allowed = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($relative in @($review.files.relativePath) + @($review.retainedCurrentFiles)) {
    [void]$allowed.Add([IO.Path]::GetFullPath((Join-Path $root $relative)))
}
foreach ($absolute in $present.Keys) { if (-not $allowed.Contains($absolute)) { throw 'Unreviewed mirror file found.' } }
$targets = [Collections.Generic.List[string]]::new()
$directories = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$remainingBytes = [int64]0
foreach ($row in $review.files) {
    $absolute = [IO.Path]::GetFullPath((Join-Path $root $row.relativePath))
    if (-not $absolute.StartsWith($root + '\', [StringComparison]::Ordinal)) { throw 'Escaped retirement member.' }
    if (-not $present.ContainsKey($absolute)) { continue }
    $item = $present[$absolute]
    Assert-PlainDirectory $item.DirectoryName
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
        $item.Length -ne $row.byteLength -or
        (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() -cne $row.sha256) {
        throw 'Reviewed mirror bytes changed.'
    }
    $targets.Add($absolute)
    $remainingBytes += $item.Length
    $parent = $item.DirectoryName
    while ($parent.StartsWith($root + '\', [StringComparison]::Ordinal)) {
        [void]$directories.Add($parent)
        $parent = Split-Path -Parent $parent
    }
}
if ($targets.Count -eq 0) { Write-Output 'All reviewed mirror files are already absent.'; return }
if (Test-Path -LiteralPath $receiptPath) { throw 'Receipt already exists while reviewed files remain.' }
if ($PSCmdlet.ShouldProcess($root, "Remove $($targets.Count) exact reviewed historical files; preserve current boundary and access controls")) {
    $before = [IO.DriveInfo]::new('E:\').AvailableFreeSpace
    foreach ($absolute in $targets) { Remove-Item -LiteralPath $absolute -Force -ErrorAction Stop }
    foreach ($absolute in $targets) { if (Test-Path -LiteralPath $absolute) { throw 'Mirror file retirement incomplete.' } }
    foreach ($directory in @($directories | Sort-Object Length -Descending)) {
        Assert-PlainDirectory $directory
        if (@(Get-ChildItem -LiteralPath $directory -Force).Count -eq 0) {
            Remove-Item -LiteralPath $directory -Force -ErrorAction Stop
        }
    }
    $after = [IO.DriveInfo]::new('E:\').AvailableFreeSpace
    $receipt = [ordered]@{
        schema = 'tinyrustlm-mirust.historical-runtime-retirement-receipt/1'
        completedUtc = [DateTime]::UtcNow.ToString('o'); root = $root; reviewSha256 = $reviewHash
        removedFiles = $targets.Count; logicalBytes = $remainingBytes; reviewedFileCount = 184
        volumeAvailableBefore = $before; volumeAvailableAfter = $after; volumeDeltaBytes = $after - $before
        measurementLimit = 'Volume free space also changes with concurrent activity.'
    }
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($receipt | ConvertTo-Json) + "`n")
    $stream = [IO.File]::Open($receiptPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) }
    finally { $stream.Dispose() }
    Write-Output 'Reviewed mirror files removed; current boundary and access controls retained.'
}
