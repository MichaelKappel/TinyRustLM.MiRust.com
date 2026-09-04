param(
    [string]$ManifestPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "deploy\site-deployment-manifest.v1.json"),
    [string]$FileZillaProfilePath = (Join-Path $env:APPDATA "FileZilla\sitemanager.xml"),
    [string]$ReportPath = (Join-Path (Split-Path -Parent $PSScriptRoot) ("deploy\receipts\site-deployment-{0}.json" -f (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ"))),
    [string]$ResumeNonce,
    [string]$NodeExecutablePath = $env:TINYRUSTLM_NODE_EXECUTABLE,
    [switch]$Publish
)

$ErrorActionPreference = "Stop"
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

    $hadNodeOptions = Test-Path Env:NODE_OPTIONS
    $savedNodeOptions = if ($hadNodeOptions) { $env:NODE_OPTIONS } else { $null }
    $hadNodePath = Test-Path Env:NODE_PATH
    $savedNodePath = if ($hadNodePath) { $env:NODE_PATH } else { $null }
    Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
    Remove-Item Env:NODE_PATH -ErrorAction SilentlyContinue
    $savedErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $gateOutput = @(& $resolvedNode $preflightItem.FullName 2>&1)
        $gateExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $savedErrorActionPreference
        if ($hadNodeOptions) { Set-Item Env:NODE_OPTIONS $savedNodeOptions }
        if ($hadNodePath) { Set-Item Env:NODE_PATH $savedNodePath }
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

Assert-CanonicalSourceAuthority
if ($Publish) {
    throw "Legacy full-site publishing is disabled. Complete the hardened source-retirement transaction and add a separately reviewed publisher that requires its exact committed terminal evidence."
}
Add-Type -AssemblyName System.Net.Http

$script:credential = $null
$script:ftpHost = $null
$script:ftpPort = 0
$script:stagingRoot = $null
$releaseVersion = "1.8.3"
$releaseDate = "2026-08-31"
$canonicalManifestPath = [IO.Path]::GetFullPath((Join-Path $repositoryRoot "deploy\site-deployment-manifest.v1.json"))
$retiredBody = "This public source copy has been permanently retired.`n"

function Invoke-GitLines {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $output = @(& git -C $repositoryRoot @Arguments)
    if ($LASTEXITCODE -ne 0) { throw "Git validation command failed." }
    return $output
}

function Get-GitScalar {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $lines = @(Invoke-GitLines -Arguments $Arguments)
    if ($lines.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$lines[0])) {
        throw "Git validation command did not return one bounded identity."
    }
    return ([string]$lines[0]).Trim()
}

function Test-PublicDeploymentPath {
    param([Parameter(Mandatory)][string]$Path)

    $publicUai = @(
        ".uai/.htaccess",
        ".uai/index.uai",
        ".uai/long-term-memory.uai"
    )
    $rootFiles = @(
        ".htaccess",
        "LICENSE.txt",
        "index.php",
        "llms-full.txt",
        "llms.txt",
        "robots.txt",
        "sitemap.xml"
    )
    $prefixes = @(".well-known/", "assets/", "data/", "docs/", "includes/")
    if ($Path.EndsWith("/.gitkeep", [StringComparison]::Ordinal)) { return $false }
    if ($Path.StartsWith("docs/runtime-portal/", [StringComparison]::Ordinal) -and
        $Path -cne "docs/runtime-portal/index.md") { return $false }
    if ($Path.StartsWith("docs/reports/", [StringComparison]::Ordinal) -and
        $Path -cne "docs/reports/.htaccess") { return $false }
    if ($publicUai -ccontains $Path -or $rootFiles -ccontains $Path) { return $true }
    foreach ($prefix in $prefixes) {
        if ($Path.StartsWith($prefix, [StringComparison]::Ordinal)) { return $true }
    }
    return $false
}

function Get-FileSha256 {
    param([Parameter(Mandatory)][string]$Path)

    $stream = [IO.File]::OpenRead($Path)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
        $stream.Dispose()
    }
}

function Assert-RelativePath {
    param([Parameter(Mandatory)][string]$Path)

    if ($Path.Length -gt 512 -or
        $Path.StartsWith("/") -or
        $Path.StartsWith("\") -or
        $Path.Contains("\") -or
        $Path -match "(^|/)\.\.(/|$)" -or
        $Path -notmatch "^[A-Za-z0-9._/-]+$" -or
        $Path -match "//") {
        throw "Deployment manifest contains an unsafe relative path."
    }
    return $Path
}

function Assert-RetiredRouteContract {
    param([Parameter(Mandatory)][pscustomobject]$Manifest)

    $retiredFiles = @($Manifest.retired_files | ForEach-Object { [string]$_ })
    if ($retiredFiles.Count -lt 1 -or $retiredFiles.Count -gt 512) {
        throw "Deployment manifest retired-file deletion closure is incomplete."
    }
    $seenRetiredFiles = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($relative in $retiredFiles) {
        Assert-RelativePath -Path $relative | Out-Null
        if (-not $seenRetiredFiles.Add($relative)) {
            throw "Deployment manifest retired-file deletion closure is not exact."
        }
    }

    $checks = @($Manifest.retired_route_checks)
    if ($checks.Count -ne $retiredFiles.Count) {
        throw "Deployment manifest retired-route closure is incomplete."
    }
    $seenCanonical = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($check in $checks) {
        $canonical = [string]$check.canonical_path
        if (-not $canonical.StartsWith("/", [StringComparison]::Ordinal) -or
            $retiredFiles -cnotcontains $canonical.Substring(1) -or
            -not $seenCanonical.Add($canonical)) {
            throw "Deployment manifest contains an unexpected or duplicate retired route."
        }
        $actualVariants = @($check.variants | ForEach-Object { [string]$_ })
        if ($actualVariants.Count -lt 1 -or $actualVariants.Count -gt 8 -or $actualVariants[0] -cne $canonical) {
            throw "Deployment manifest retired-route variant closure is incomplete."
        }
        $seenVariants = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($variant in $actualVariants) {
            if ($variant.Length -gt 512 -or
                -not $variant.StartsWith("/", [StringComparison]::Ordinal) -or
                $variant.Contains("\") -or $variant.Contains("?") -or $variant.Contains("#") -or
                $variant -match "[\x00-\x1F\x7F]" -or -not $seenVariants.Add($variant)) {
                throw "Deployment manifest retired-route variants are not exact and bounded."
            }
        }
    }
}

function Assert-ExactStagingClosure {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][Collections.Generic.HashSet[string]]$ExpectedPaths
    )

    if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
        throw "Deployment staging root is unavailable."
    }
    $cursor = [IO.Path]::GetFullPath($Root)
    if (-not $cursor.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Deployment staging root is outside the repository boundary."
    }
    while ($cursor.StartsWith($repositoryRoot, [StringComparison]::OrdinalIgnoreCase)) {
        $cursorItem = Get-Item -LiteralPath $cursor -Force
        if (($cursorItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Deployment staging root or ancestor must not be a reparse point."
        }
        if ([string]::Equals($cursor, $repositoryRoot, [StringComparison]::OrdinalIgnoreCase)) { break }
        $parent = Split-Path -Parent $cursor
        if ([string]::Equals($parent, $cursor, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Deployment staging root is outside the repository boundary."
        }
        $cursor = $parent
    }
    $actual = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($item in @(Get-ChildItem -LiteralPath $Root -Recurse -Force)) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Deployment staging closure must not contain links or reparse points."
        }
        if ($item.PSIsContainer) { continue }
        $relative = $item.FullName.Substring($Root.Length).TrimStart([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar).Replace("\", "/")
        Assert-RelativePath -Path $relative | Out-Null
        if (-not $actual.Add($relative)) { throw "Deployment staging closure contains a duplicate path." }
    }
    if ($actual.Count -ne $ExpectedPaths.Count) {
        throw "Deployment staging closure file count does not match the manifest."
    }
    foreach ($relative in $ExpectedPaths) {
        if (-not $actual.Contains($relative)) {
            throw "Deployment staging closure is missing a manifest path."
        }
    }
}

function Assert-CommitAndPublicClosure {
    param(
        [Parameter(Mandatory)][pscustomobject]$Manifest,
        [Parameter(Mandatory)][Collections.Generic.HashSet[string]]$ManifestPaths
    )

    $commit = [string]$Manifest.source_commit
    Invoke-GitLines -Arguments @("cat-file", "-e", "$commit^{commit}") | Out-Null
    $commitTree = Get-GitScalar -Arguments @("rev-parse", "$commit^{tree}")
    if ($commitTree -cne [string]$Manifest.source_tree) {
        throw "Deployment manifest source_tree does not equal source_commit^{tree}."
    }

    $expectedPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($candidate in @(Invoke-GitLines -Arguments @("ls-tree", "-r", "--name-only", $commit))) {
        $relative = [string]$candidate
        if (-not (Test-PublicDeploymentPath -Path $relative)) { continue }
        Assert-RelativePath -Path $relative | Out-Null
        if (-not $expectedPaths.Add($relative)) {
            throw "Git public closure contains a duplicate path."
        }
    }
    if ($expectedPaths.Count -ne $ManifestPaths.Count) {
        throw "Deployment manifest path closure does not equal the source commit public closure."
    }
    foreach ($relative in $expectedPaths) {
        if (-not $ManifestPaths.Contains($relative)) {
            throw "Deployment manifest omits or replaces a source commit public path."
        }
    }

    foreach ($file in @($Manifest.files)) {
        $relative = [string]$file.path
        $localPath = [IO.Path]::GetFullPath((Join-Path $script:stagingRoot ($relative -replace "/", "\")))
        $commitBlob = Get-GitScalar -Arguments @("rev-parse", "${commit}:$relative")
        $localBlob = Get-GitScalar -Arguments @("hash-object", "--no-filters", "--", $localPath)
        $commitBytesText = Get-GitScalar -Arguments @("cat-file", "-s", "${commit}:$relative")
        $commitBytes = [int64]0
        if (-not [int64]::TryParse($commitBytesText, [ref]$commitBytes) -or
            $commitBytes -ne [int64]$file.bytes -or
            $commitBlob -cne $localBlob) {
            throw "Staged file bytes do not equal the source commit blob: $relative"
        }
    }
}

function Assert-SharedPublicArtifactPolicy {
    param([Parameter(Mandatory)][string]$ManifestPath, [Parameter(Mandatory)][string]$StagingRoot)

    $validator = Join-Path $PSScriptRoot "verify-site-deployment-input.js"
    if (-not (Test-Path -LiteralPath $validator -PathType Leaf)) {
        throw "Shared public-artifact deployment validator is unavailable."
    }
    & $script:verifiedNodeExecutablePath $validator $ManifestPath $StagingRoot
    if ($LASTEXITCODE -ne 0) { throw "Shared public-artifact deployment validation failed." }
}

function Get-EncodedRemotePath {
    param([string]$RemotePath)

    if ([string]::IsNullOrEmpty($RemotePath)) { return "" }
    $validated = Assert-RelativePath -Path $RemotePath
    return (($validated -split "/") | ForEach-Object { [Uri]::EscapeDataString($_) }) -join "/"
}

function Get-CredentialProfile {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$ProfileName)

    $resolved = [IO.Path]::GetFullPath($Path)
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        throw "The external FileZilla profile is unavailable."
    }
    $item = Get-Item -LiteralPath $resolved
    if ($item.Length -lt 1 -or $item.Length -gt 1048576) {
        throw "The external FileZilla profile has an invalid size."
    }

    $settings = [Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [Xml.XmlReader]::Create($resolved, $settings)
    $document = [Xml.XmlDocument]::new()
    $document.XmlResolver = $null
    try { $document.Load($reader) } finally { $reader.Dispose() }

    $matches = @($document.SelectNodes("/FileZilla3/Servers/Server") | Where-Object {
        $name = $_.SelectSingleNode("Name")
        $name -and [string]::Equals([string]$name.InnerText, $ProfileName, [StringComparison]::Ordinal)
    })
    if ($matches.Count -ne 1) {
        throw "The external FileZilla profile must contain exactly one matching site."
    }

    $site = $matches[0]
    $required = {
        param([string]$Name)
        $node = $site.SelectSingleNode($Name)
        if (-not $node -or [string]::IsNullOrWhiteSpace([string]$node.InnerText)) {
            throw "The deployment profile is missing a required field."
        }
        return ([string]$node.InnerText).Trim()
    }

    $hostName = & $required "Host"
    $portText = & $required "Port"
    $userName = & $required "User"
    $passwordNode = $site.SelectSingleNode("Pass")
    if (-not $passwordNode) { throw "The deployment profile is missing a required field." }
    $encoding = if ($passwordNode.Attributes["encoding"]) { [string]$passwordNode.Attributes["encoding"].Value } else { "" }
    if ($encoding -and -not [string]::Equals($encoding, "base64", [StringComparison]::OrdinalIgnoreCase)) {
        throw "The deployment profile password encoding is unsupported."
    }
    $password = if ($encoding) {
        [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$passwordNode.InnerText))
    }
    else { [string]$passwordNode.InnerText }

    $port = 0
    if ([Uri]::CheckHostName($hostName) -eq [UriHostNameType]::Unknown -or
        -not [int]::TryParse($portText, [ref]$port) -or
        $port -lt 1 -or $port -gt 65535 -or
        $userName.Length -gt 256 -or
        [string]::IsNullOrEmpty($password) -or $password.Length -gt 4096) {
        $password = $null
        throw "The deployment profile contains an invalid bounded field."
    }

    return [pscustomobject]@{ Host = $hostName; Port = $port; User = $userName; Password = $password }
}

function New-FtpRequest {
    param([string]$RemotePath, [Parameter(Mandatory)][string]$Method)

    $encoded = Get-EncodedRemotePath -RemotePath $RemotePath
    $uri = [Uri]("ftp://{0}:{1}/{2}" -f $script:ftpHost, $script:ftpPort, $encoded)
    $request = [Net.FtpWebRequest]::Create($uri)
    $request.Method = $Method
    $request.EnableSsl = $true
    $request.UseBinary = $true
    $request.UsePassive = $true
    $request.KeepAlive = $false
    $request.Timeout = 300000
    $request.ReadWriteTimeout = 300000
    $request.Credentials = $script:credential
    return $request
}

function Test-FileUnavailableError {
    param([Exception]$Exception)

    $current = $Exception
    while ($current.InnerException) { $current = $current.InnerException }
    return $current -is [Net.WebException] -and
        $current.Response -is [Net.FtpWebResponse] -and
        [int]$current.Response.StatusCode -eq 550
}

function Get-RemoteSize {
    param([Parameter(Mandatory)][string]$RemotePath)

    try {
        $request = New-FtpRequest -RemotePath $RemotePath -Method ([Net.WebRequestMethods+Ftp]::GetFileSize)
        $response = $request.GetResponse()
        try { return [int64]$response.ContentLength } finally { $response.Dispose() }
    }
    catch {
        if (Test-FileUnavailableError -Exception $_.Exception) { return [int64]-1 }
        throw
    }
}

function Get-RemoteSha256 {
    param([Parameter(Mandatory)][string]$RemotePath)

    $request = New-FtpRequest -RemotePath $RemotePath -Method ([Net.WebRequestMethods+Ftp]::DownloadFile)
    $response = $request.GetResponse()
    $stream = $response.GetResponseStream()
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
        $stream.Dispose()
        $response.Dispose()
    }
}

function Get-LocalPrefixSha256 {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][int64]$Bytes)

    $item = Get-Item -LiteralPath $Path
    if ($Bytes -lt 0 -or $Bytes -gt $item.Length) { throw "Invalid local prefix length." }
    $stream = [IO.File]::OpenRead($Path)
    $sha = [Security.Cryptography.SHA256]::Create()
    $buffer = New-Object byte[] 65536
    $remaining = $Bytes
    try {
        while ($remaining -gt 0) {
            $requested = [int][Math]::Min([int64]$buffer.Length, $remaining)
            $read = $stream.Read($buffer, 0, $requested)
            if ($read -ne $requested) { throw "Unexpected end of staged deployment file." }
            $sha.TransformBlock($buffer, 0, $read, $buffer, 0) | Out-Null
            $remaining -= $read
        }
        $empty = New-Object byte[] 0
        $sha.TransformFinalBlock($empty, 0, 0) | Out-Null
        return ([BitConverter]::ToString($sha.Hash)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
        $stream.Dispose()
    }
}

function Test-RemoteIdentity {
    param([string]$RemotePath, [int64]$Bytes, [string]$Sha256)

    $size = Get-RemoteSize -RemotePath $RemotePath
    return $size -eq $Bytes -and (Get-RemoteSha256 -RemotePath $RemotePath) -ceq $Sha256
}

function Test-RemoteDirectory {
    param([string]$RemotePath)

    try {
        $request = New-FtpRequest -RemotePath $RemotePath -Method ([Net.WebRequestMethods+Ftp]::ListDirectory)
        $response = $request.GetResponse()
        $response.Dispose()
        return $true
    }
    catch {
        if (Test-FileUnavailableError -Exception $_.Exception) { return $false }
        throw
    }
}

function Ensure-RemoteDirectory {
    param([string]$RemotePath)

    if ([string]::IsNullOrEmpty($RemotePath) -or (Test-RemoteDirectory -RemotePath $RemotePath)) { return }
    $request = New-FtpRequest -RemotePath $RemotePath -Method ([Net.WebRequestMethods+Ftp]::MakeDirectory)
    $response = $request.GetResponse()
    $response.Dispose()
    if (-not (Test-RemoteDirectory -RemotePath $RemotePath)) {
        throw "Remote directory creation did not commit."
    }
}

function Ensure-RemoteParentDirectories {
    param([string]$RemotePath)

    $parts = $RemotePath -split "/"
    $current = @()
    for ($index = 0; $index -lt $parts.Count - 1; $index++) {
        $current += $parts[$index]
        Ensure-RemoteDirectory -RemotePath ($current -join "/")
    }
}

function Remove-RemoteFileIfPresent {
    param([string]$RemotePath)

    if ((Get-RemoteSize -RemotePath $RemotePath) -lt 0) { return }
    $request = New-FtpRequest -RemotePath $RemotePath -Method ([Net.WebRequestMethods+Ftp]::DeleteFile)
    $response = $request.GetResponse()
    $response.Dispose()
    if ((Get-RemoteSize -RemotePath $RemotePath) -ge 0) { throw "Remote file deletion did not commit." }
}

function Rename-RemoteFile {
    param([string]$RemotePath, [string]$NewLeafName)

    if ($NewLeafName -notmatch "^[A-Za-z0-9._-]+$") { throw "Unsafe remote rename leaf." }
    $request = New-FtpRequest -RemotePath $RemotePath -Method ([Net.WebRequestMethods+Ftp]::Rename)
    $request.RenameTo = $NewLeafName
    $response = $request.GetResponse()
    $response.Dispose()
}

function Write-RemoteChunk {
    param([string]$RemotePath, [byte[]]$Bytes, [bool]$Append)

    $method = if ($Append) { [Net.WebRequestMethods+Ftp]::AppendFile } else { [Net.WebRequestMethods+Ftp]::UploadFile }
    $request = New-FtpRequest -RemotePath $RemotePath -Method $method
    $request.ContentLength = $Bytes.Length
    $output = $null
    try {
        $output = $request.GetRequestStream()
        $output.Write($Bytes, 0, $Bytes.Length)
        $output.Flush()
        try { $output.Dispose() } catch { }
        $output = $null
        try {
            $response = $request.GetResponse()
            $response.Dispose()
        }
        catch {
            # This host can return 451 after committing a chunk. The caller
            # treats the authenticated remote size as the authority.
        }
    }
    catch {
        # The caller confirms whether the intended offset committed.
    }
    finally {
        if ($output) { try { $output.Dispose() } catch { } }
    }
}

function Send-RemoteFile {
    param([string]$LocalPath, [string]$RemotePath)

    $expectedBytes = (Get-Item -LiteralPath $LocalPath).Length
    $input = [IO.File]::OpenRead($LocalPath)
    $offset = [int64]0
    try {
        $remoteBytes = Get-RemoteSize -RemotePath $RemotePath
        if ($remoteBytes -gt $expectedBytes -or $remoteBytes -eq 0) {
            Remove-RemoteFileIfPresent -RemotePath $RemotePath
            $remoteBytes = -1
        }
        if ($remoteBytes -gt 0) {
            $remoteSha256 = Get-RemoteSha256 -RemotePath $RemotePath
            $localPrefixSha256 = Get-LocalPrefixSha256 -Path $LocalPath -Bytes $remoteBytes
            if ($remoteSha256 -cne $localPrefixSha256) {
                Remove-RemoteFileIfPresent -RemotePath $RemotePath
                $remoteBytes = -1
            }
            else {
                $offset = $remoteBytes
                $input.Seek($offset, [IO.SeekOrigin]::Begin) | Out-Null
                Write-Host "RESUME $RemotePath at $offset bytes"
            }
        }
        while ($offset -lt $expectedBytes) {
            $count = [int][Math]::Min([int64]8192, $expectedBytes - $offset)
            $chunk = New-Object byte[] $count
            $read = $input.Read($chunk, 0, $count)
            if ($read -ne $count) { throw "Unexpected end of staged deployment file." }
            $intendedSize = $offset + $count
            $committed = $false
            for ($attempt = 1; $attempt -le 6; $attempt++) {
                Write-RemoteChunk -RemotePath $RemotePath -Bytes $chunk -Append ($offset -gt 0)
                Start-Sleep -Milliseconds 250
                $actualSize = Get-RemoteSize -RemotePath $RemotePath
                if ($actualSize -eq $intendedSize) {
                    $committed = $true
                    break
                }
                if ($actualSize -ne $offset) {
                    throw "Remote staging offset drifted from the intended chunk boundary."
                }
                Start-Sleep -Milliseconds (250 * $attempt)
            }
            if (-not $committed) { throw "Remote staging made no progress after bounded retries." }
            $offset = $intendedSize
        }
    }
    finally {
        $input.Dispose()
    }
}

function Get-SafeFailureCode {
    param([Exception]$Exception)

    $current = $Exception
    while ($current.InnerException) { $current = $current.InnerException }
    $code = $current.GetType().FullName
    if ($current -is [Net.WebException]) {
        $code += "/" + [string]$current.Status
        if ($current.Response -is [Net.FtpWebResponse]) {
            $code += "/ftp-" + [int]$current.Response.StatusCode
        }
    }
    return $code
}

function Read-BoundedHttpBody {
    param([Parameter(Mandatory)][Net.Http.HttpResponseMessage]$Response, [Parameter(Mandatory)][int]$MaximumBytes)

    $stream = $Response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    $buffer = New-Object byte[] ($MaximumBytes + 1)
    $total = 0
    try {
        while ($total -le $MaximumBytes) {
            $read = $stream.Read($buffer, $total, $buffer.Length - $total)
            if ($read -eq 0) { break }
            $total += $read
            if ($total -gt $MaximumBytes) { throw "HTTPS response exceeded its bounded body limit." }
        }
        $result = New-Object byte[] $total
        if ($total -gt 0) { [Array]::Copy($buffer, $result, $total) }
        return $result
    }
    finally {
        $stream.Dispose()
    }
}

function Assert-ExactResponseHeader {
    param(
        [Parameter(Mandatory)][Net.Http.HttpResponseMessage]$Response,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Expected
    )

    $values = @()
    if ($Response.Headers.Contains($Name)) { $values += @($Response.Headers.GetValues($Name)) }
    if ($Response.Content.Headers.Contains($Name)) { $values += @($Response.Content.Headers.GetValues($Name)) }
    if ($values.Count -ne 1 -or [string]$values[0] -cne $Expected) {
        throw "HTTPS retired-route header mismatch: $Name"
    }
}

function Assert-RetiredRouteReadback {
    param(
        [Parameter(Mandatory)][Net.Http.HttpClient]$Client,
        [Parameter(Mandatory)][string]$Origin,
        [Parameter(Mandatory)][string]$RequestPath,
        [Parameter(Mandatory)][string]$Method,
        [Parameter(Mandatory)][string]$Nonce,
        [Parameter(Mandatory)][bool]$CacheBusted
    )

    $url = "{0}{1}" -f $Origin, $RequestPath
    if ($CacheBusted) { $url += "?release_retired=$Nonce" }
    $httpMethod = if ($Method -ceq "HEAD") { [Net.Http.HttpMethod]::Head } else { [Net.Http.HttpMethod]::Get }
    $request = [Net.Http.HttpRequestMessage]::new($httpMethod, $url)
    $response = $Client.SendAsync($request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    try {
        if ([int]$response.StatusCode -ne 410) { throw "HTTPS retired route did not return 410 Gone." }
        if ($null -ne $response.Headers.Location -or $response.Headers.Contains("Location")) {
            throw "HTTPS retired route returned a forbidden Location header."
        }
        Assert-ExactResponseHeader -Response $response -Name "Cache-Control" -Expected "no-store"
        Assert-ExactResponseHeader -Response $response -Name "X-Robots-Tag" -Expected "noindex, nofollow"
        Assert-ExactResponseHeader -Response $response -Name "X-Content-Type-Options" -Expected "nosniff"
        Assert-ExactResponseHeader -Response $response -Name "Content-Type" -Expected "text/plain; charset=utf-8"
        if ($response.Content.Headers.ContentLength -ne [Text.Encoding]::UTF8.GetByteCount($retiredBody)) {
            throw "HTTPS retired-route Content-Length is not exact."
        }
        $body = Read-BoundedHttpBody -Response $response -MaximumBytes 128
        if ($Method -ceq "HEAD") {
            if ($body.Length -ne 0) { throw "HTTPS retired-route HEAD response included a body." }
        }
        else {
            $actualBody = [Text.Encoding]::UTF8.GetString($body)
            if ($actualBody -cne $retiredBody) { throw "HTTPS retired-route body is not exact." }
        }
    }
    finally {
        $response.Dispose()
        $request.Dispose()
    }
}

function Publish-File {
    param([pscustomobject]$File, [string]$Nonce)

    $relative = [string]$File.path
    $localPath = [IO.Path]::GetFullPath((Join-Path $script:stagingRoot ($relative -replace "/", "\")))
    if (-not $localPath.StartsWith($script:stagingRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Staged deployment path escaped the staging root."
    }
    if (Test-RemoteIdentity -RemotePath $relative -Bytes ([int64]$File.bytes) -Sha256 ([string]$File.sha256)) {
        Write-Host "SKIP $relative"
        return "already-current"
    }

    Ensure-RemoteParentDirectories -RemotePath $relative
    $lastSlash = $relative.LastIndexOf("/")
    $parent = if ($lastSlash -ge 0) { $relative.Substring(0, $lastSlash + 1) } else { "" }
    $leaf = if ($lastSlash -ge 0) { $relative.Substring($lastSlash + 1) } else { $relative }
    $extension = [IO.Path]::GetExtension($leaf)
    $stem = $leaf.Substring(0, $leaf.Length - $extension.Length)
    $stageLeaf = "$stem.deploy-$Nonce$extension"
    $backupLeaf = "$stem.backup-$Nonce$extension"
    $stagePath = "$parent$stageLeaf"
    $backupPath = "$parent$backupLeaf"
    Remove-RemoteFileIfPresent -RemotePath $backupPath
    try {
        Send-RemoteFile -LocalPath $localPath -RemotePath $stagePath
        if (-not (Test-RemoteIdentity -RemotePath $stagePath -Bytes ([int64]$File.bytes) -Sha256 ([string]$File.sha256))) {
            throw "Staged remote identity mismatch for $relative"
        }
    }
    catch {
        throw
    }

    $hadTarget = (Get-RemoteSize -RemotePath $relative) -ge 0
    try {
        if ($hadTarget) { Rename-RemoteFile -RemotePath $relative -NewLeafName $backupLeaf }
        Rename-RemoteFile -RemotePath $stagePath -NewLeafName $leaf
        if (-not (Test-RemoteIdentity -RemotePath $relative -Bytes ([int64]$File.bytes) -Sha256 ([string]$File.sha256))) {
            throw "Published remote identity mismatch for $relative"
        }
        Remove-RemoteFileIfPresent -RemotePath $backupPath
    }
    catch {
        Remove-RemoteFileIfPresent -RemotePath $relative
        if ($hadTarget -and (Get-RemoteSize -RemotePath $backupPath) -ge 0) {
            Rename-RemoteFile -RemotePath $backupPath -NewLeafName $leaf
        }
        Remove-RemoteFileIfPresent -RemotePath $stagePath
        throw
    }
    Write-Host "PUBLISH $relative"
    return "published"
}

function Write-Receipt {
    param([System.Collections.IDictionary]$Receipt, [string]$Path)

    $resolved = [IO.Path]::GetFullPath($Path)
    if (Test-Path -LiteralPath $resolved) { throw "Deployment receipts are append-only." }
    $directory = Split-Path -Parent $resolved
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $temporary = Join-Path $directory ((Split-Path -Leaf $resolved) + ".tmp")
    if (Test-Path -LiteralPath $temporary) { throw "Deployment receipt staging path is occupied." }
    [IO.File]::WriteAllText($temporary, (($Receipt | ConvertTo-Json -Depth 8) + "`n"), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporary -Destination $resolved
}

function Assert-EvidenceGitAttributes {
    $required = @(
        "deploy/site-deployment-manifest.v1.json binary",
        "deploy/receipts/*.json binary"
    )
    $committed = @(git -C $repositoryRoot show "HEAD:.gitattributes")
    if ($LASTEXITCODE -ne 0) { throw "Evidence byte-preservation attributes are not committed." }
    foreach ($line in $required) {
        if ($committed -cnotcontains $line) {
            throw "Evidence byte-preservation attributes are incomplete."
        }
    }

    $effective = @(git -C $repositoryRoot check-attr binary -- `
        "deploy/site-deployment-manifest.v1.json" `
        "deploy/receipts/__future-receipt__.json")
    if ($LASTEXITCODE -ne 0 -or
        $effective -cnotcontains "deploy/site-deployment-manifest.v1.json: binary: set" -or
        $effective -cnotcontains "deploy/receipts/__future-receipt__.json: binary: set") {
        throw "Evidence byte-preservation attributes are not effective."
    }
}

Assert-EvidenceGitAttributes
$resolvedManifestPath = [IO.Path]::GetFullPath($ManifestPath)
if (-not [string]::Equals($resolvedManifestPath, $canonicalManifestPath, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Deployment must use the canonical repository manifest path."
}
$manifestItem = Get-Item -LiteralPath $resolvedManifestPath
if (($manifestItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Deployment manifest must not be a link or reparse point."
}
if ($manifestItem.Length -lt 1 -or $manifestItem.Length -gt 2097152) { throw "Deployment manifest size is invalid." }
$manifestSha256 = Get-FileSha256 -Path $manifestItem.FullName
$manifest = Get-Content -Raw -LiteralPath $manifestItem.FullName | ConvertFrom-Json
if ($manifest.schema -cne "tinyrustlm.mirust.site_deployment_manifest.v1" -or
    $manifest.site -cne "TinyRustLM.MiRust.com" -or
    $manifest.origin -cne "https://tinyrustlm.mirust.com" -or
    $manifest.version -cne $releaseVersion -or
    $manifest.release_date -cne $releaseDate -or
    $manifest.status -cne "commit-bound-candidate" -or
    $manifest.publication_claim -cne "not-published-by-this-manifest" -or
    $manifest.retirement_policy -cne "last-verified-publication-minus-current-public-closure" -or
    $manifest.source_commit -notmatch "^[0-9a-f]{40}$" -or
    $manifest.source_tree -notmatch "^[0-9a-f]{40}$" -or
    @($manifest.files).Count -lt 20 -or @($manifest.files).Count -gt 512) {
    throw "Deployment manifest identity or bounds are invalid."
}
if ($manifest.last_verified_publication.version -cne "1.8.2" -or
    $manifest.last_verified_publication.source_commit -cne "2547720541dfb927a81a85ae3eac3222908b9771" -or
    $manifest.last_verified_publication.source_tree -cne "bc7b4a9d5c74e4f94fb7a168211a865fb099dadc" -or
    $manifest.last_verified_publication.receipt -cne "deploy/receipts/site-deployment-20260830T014629Z.json" -or
    $manifest.last_verified_publication.receipt_sha256 -cne "e762a900aad256d5783ea5fbdec68307f95b08d4e0f1f76db6765329fa172cf2") {
    throw "Deployment manifest last-verified publication identity drifted."
}
Assert-RetiredRouteContract -Manifest $manifest

$seen = @{}
$manifestPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$totalBytes = [int64]0
$script:stagingRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot ("deploy\staging\{0}" -f [string]$manifest.version)))
foreach ($file in @($manifest.files)) {
    $relative = Assert-RelativePath -Path ([string]$file.path)
    if ($seen.ContainsKey($relative) -or -not $manifestPaths.Add($relative)) { throw "Deployment manifest contains a duplicate path." }
    if (-not (Test-PublicDeploymentPath -Path $relative)) { throw "Deployment manifest contains a non-public path." }
    foreach ($retiredPath in @($manifest.retired_files)) {
        if ([string]::Equals($relative, [string]$retiredPath, [StringComparison]::Ordinal)) {
            throw "Deployment manifest must not publish a retired source-copy path."
        }
    }
    $seen[$relative] = $true
    $bytes = [int64]$file.bytes
    if ($bytes -lt 0 -or $bytes -gt 16777216 -or [string]$file.sha256 -notmatch "^[0-9a-f]{64}$") {
        throw "Deployment manifest contains an invalid file identity."
    }
    $totalBytes += $bytes
    $localPath = [IO.Path]::GetFullPath((Join-Path $script:stagingRoot ($relative -replace "/", "\")))
    if (-not (Test-Path -LiteralPath $localPath -PathType Leaf) -or
        (Get-Item -LiteralPath $localPath).Length -ne $bytes -or
        (Get-FileSha256 -Path $localPath) -cne [string]$file.sha256) {
        throw "Local file identity does not match the deployment manifest: $relative"
    }
}
if ($totalBytes -gt 67108864) { throw "Deployment closure exceeds the total byte budget." }

$gitStatus = @(git -C $repositoryRoot status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0 -or $gitStatus.Count -ne 0) { throw "Publishing requires a clean Git worktree." }
git -C $repositoryRoot merge-base --is-ancestor ([string]$manifest.source_commit) HEAD
if ($LASTEXITCODE -ne 0) { throw "Manifest source commit is not an ancestor of the publishing checkout." }

Assert-ExactStagingClosure -Root $script:stagingRoot -ExpectedPaths $manifestPaths
Assert-CommitAndPublicClosure -Manifest $manifest -ManifestPaths $manifestPaths
Assert-SharedPublicArtifactPolicy -ManifestPath $resolvedManifestPath -StagingRoot $script:stagingRoot

Write-Host ("VALID {0} files, {1} bytes, manifest {2}" -f @($manifest.files).Count, $totalBytes, $manifestSha256)
if (-not $Publish) { exit 0 }

$receiptRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot "deploy\receipts"))
$resolvedReportPath = [IO.Path]::GetFullPath($ReportPath)
$reportLeaf = Split-Path -Leaf $resolvedReportPath
if (-not [string]::Equals((Split-Path -Parent $resolvedReportPath), $receiptRoot, [StringComparison]::OrdinalIgnoreCase) -or
    $reportLeaf -notmatch "^site-deployment-[0-9]{8}T[0-9]{6}Z\.json$" -or
    (Test-Path -LiteralPath $resolvedReportPath)) {
    throw "Publication receipt path must be a fresh canonical append-only receipt path."
}
$ReportPath = $resolvedReportPath

$startedUtc = (Get-Date).ToUniversalTime().ToString("o")
$nonce = if ([string]::IsNullOrEmpty($ResumeNonce)) {
    [Guid]::NewGuid().ToString("N").Substring(0, 12)
}
else {
    if ($ResumeNonce -notmatch "^[0-9a-f]{12}$") { throw "Resume nonce must be exactly 12 lowercase hexadecimal characters." }
    $ResumeNonce
}
$results = @()
$retiredResults = @()
$currentPath = $null
$profile = Get-CredentialProfile -Path $FileZillaProfilePath -ProfileName ([string]$manifest.transport_profile)
try {
    $script:ftpHost = $profile.Host
    $script:ftpPort = $profile.Port
    $script:credential = [Net.NetworkCredential]::new($profile.User, $profile.Password)
    $profile.Password = $null

    foreach ($file in @($manifest.files)) {
        $currentPath = [string]$file.path
        $status = Publish-File -File $file -Nonce $nonce
        $results += [ordered]@{ path = [string]$file.path; status = $status; bytes = [int64]$file.bytes; sha256 = [string]$file.sha256 }
    }

    foreach ($retiredFile in @($manifest.retired_files)) {
        $currentPath = [string]$retiredFile
        $wasPresent = (Get-RemoteSize -RemotePath $currentPath) -ge 0
        Remove-RemoteFileIfPresent -RemotePath $currentPath
        if ((Get-RemoteSize -RemotePath $currentPath) -ge 0) {
            throw "Retired remote source copy remains present after deletion."
        }
        $retiredResults += [ordered]@{
            path = $currentPath
            status = if ($wasPresent) { "deleted" } else { "already-absent" }
        }
        Write-Host "RETIRE $currentPath"
    }

    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $client = [Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(60)
    try {
        foreach ($file in @($manifest.files | Where-Object { $null -ne $_.https_readback_path })) {
            $url = "{0}{1}?release_readback={2}" -f $manifest.origin, $file.https_readback_path, $nonce
            $response = $client.GetAsync($url).GetAwaiter().GetResult()
            try {
                if ([int]$response.StatusCode -ne 200) { throw "HTTPS readback failed for $($file.path)." }
                $body = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
                $sha = [Security.Cryptography.SHA256]::Create()
                try { $actual = ([BitConverter]::ToString($sha.ComputeHash($body))).Replace("-", "").ToLowerInvariant() } finally { $sha.Dispose() }
                if ($body.Length -ne [int64]$file.bytes -or $actual -cne [string]$file.sha256) {
                    throw "HTTPS readback identity mismatch for $($file.path)."
                }
            }
            finally { $response.Dispose() }
            Write-Host "READBACK $($file.path)"
        }

        foreach ($route in @($manifest.route_smokes)) {
            $url = "{0}{1}?release_smoke={2}" -f $manifest.origin, $route.path, $nonce
            $response = $client.GetAsync($url).GetAwaiter().GetResult()
            try {
                $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                if ([int]$response.StatusCode -ne 200 -or -not $body.Contains([string]$route.contains)) {
                    throw "HTTPS route smoke failed for $($route.path)."
                }
            }
            finally { $response.Dispose() }
            Write-Host "SMOKE $($route.path)"
        }

        foreach ($retired in @($manifest.retired_route_checks)) {
            foreach ($variant in @($retired.variants)) {
                foreach ($cacheBusted in @($false, $true)) {
                    Assert-RetiredRouteReadback -Client $client -Origin ([string]$manifest.origin) -RequestPath ([string]$variant) -Method "GET" -Nonce $nonce -CacheBusted $cacheBusted
                    Assert-RetiredRouteReadback -Client $client -Origin ([string]$manifest.origin) -RequestPath ([string]$variant) -Method "HEAD" -Nonce $nonce -CacheBusted $cacheBusted
                    $mode = if ($cacheBusted) { "nonce" } else { "bare" }
                    Write-Host "RETIRED $mode GET+HEAD $variant"
                }
            }
        }
    }
    finally { $client.Dispose(); $handler.Dispose() }

    $receipt = [ordered]@{
        schema = "tinyrustlm.mirust.site_deployment_receipt.v1"
        site = [string]$manifest.site
        origin = [string]$manifest.origin
        version = [string]$manifest.version
        source_commit = [string]$manifest.source_commit
        source_tree = [string]$manifest.source_tree
        publisher_commit = [string](git -C $repositoryRoot rev-parse HEAD)
        manifest_sha256 = $manifestSha256
        operation_nonce = $nonce
        started_utc = $startedUtc
        completed_utc = (Get-Date).ToUniversalTime().ToString("o")
        status = "published-and-readback-verified"
        file_count = @($manifest.files).Count
        total_bytes = $totalBytes
        published_count = @($results | Where-Object { $_.status -eq "published" }).Count
        already_current_count = @($results | Where-Object { $_.status -eq "already-current" }).Count
        retired_route_count = @($manifest.retired_route_checks).Count
        retired_route_request_count = (@($manifest.retired_route_checks | ForEach-Object { @($_.variants).Count }) | Measure-Object -Sum).Sum * 4
        retired_files = $retiredResults
        files = $results
    }
    Write-Receipt -Receipt $receipt -Path $ReportPath
    Write-Host "RECEIPT $ReportPath"
}
catch {
    $failure = [ordered]@{
        schema = "tinyrustlm.mirust.site_deployment_receipt.v1"
        site = [string]$manifest.site
        origin = [string]$manifest.origin
        version = [string]$manifest.version
        source_commit = [string]$manifest.source_commit
        source_tree = [string]$manifest.source_tree
        publisher_commit = [string](git -C $repositoryRoot rev-parse HEAD)
        manifest_sha256 = $manifestSha256
        operation_nonce = $nonce
        started_utc = $startedUtc
        completed_utc = (Get-Date).ToUniversalTime().ToString("o")
        status = "failed"
        failure_code = Get-SafeFailureCode -Exception $_.Exception
        current_path = $currentPath
        completed_file_count = $results.Count
        completed_retired_file_count = $retiredResults.Count
        retired_files = $retiredResults
        files = $results
    }
    Write-Receipt -Receipt $failure -Path $ReportPath
    Write-Host "FAILURE_RECEIPT $ReportPath"
    throw
}
finally {
    if ($profile) { $profile.Password = $null }
    $script:credential = $null
}
