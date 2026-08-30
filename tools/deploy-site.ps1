param(
    [string]$ManifestPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "deploy\site-deployment-manifest.v1.json"),
    [string]$FileZillaProfilePath = (Join-Path $env:APPDATA "FileZilla\sitemanager.xml"),
    [string]$ReportPath = (Join-Path (Split-Path -Parent $PSScriptRoot) ("deploy\receipts\site-deployment-{0}.json" -f (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ"))),
    [string]$ResumeNonce,
    [switch]$Publish
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$repositoryRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$script:credential = $null
$script:ftpHost = $null
$script:ftpPort = 0
$script:stagingRoot = $null

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

$manifestItem = Get-Item -LiteralPath $ManifestPath
if ($manifestItem.Length -lt 1 -or $manifestItem.Length -gt 2097152) { throw "Deployment manifest size is invalid." }
$manifestSha256 = Get-FileSha256 -Path $manifestItem.FullName
$manifest = Get-Content -Raw -LiteralPath $manifestItem.FullName | ConvertFrom-Json
if ($manifest.schema -cne "tinyrustlm.mirust.site_deployment_manifest.v1" -or
    $manifest.site -cne "TinyRustLM.MiRust.com" -or
    $manifest.origin -cne "https://tinyrustlm.mirust.com" -or
    $manifest.version -cne "1.8.2" -or
    $manifest.source_commit -notmatch "^[0-9a-f]{40}$" -or
    $manifest.source_tree -notmatch "^[0-9a-f]{40}$" -or
    @($manifest.files).Count -lt 200 -or @($manifest.files).Count -gt 300) {
    throw "Deployment manifest identity or bounds are invalid."
}

$seen = @{}
$totalBytes = [int64]0
$script:stagingRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot ("deploy\staging\{0}" -f [string]$manifest.version)))
foreach ($file in @($manifest.files)) {
    $relative = Assert-RelativePath -Path ([string]$file.path)
    if ($seen.ContainsKey($relative)) { throw "Deployment manifest contains a duplicate path." }
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

Write-Host ("VALID {0} files, {1} bytes, manifest {2}" -f @($manifest.files).Count, $totalBytes, $manifestSha256)
if (-not $Publish) { exit 0 }

$startedUtc = (Get-Date).ToUniversalTime().ToString("o")
$nonce = if ([string]::IsNullOrEmpty($ResumeNonce)) {
    [Guid]::NewGuid().ToString("N").Substring(0, 12)
}
else {
    if ($ResumeNonce -notmatch "^[0-9a-f]{12}$") { throw "Resume nonce must be exactly 12 lowercase hexadecimal characters." }
    $ResumeNonce
}
$results = @()
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
