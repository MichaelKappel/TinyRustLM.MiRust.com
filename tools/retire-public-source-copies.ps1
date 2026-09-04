[CmdletBinding()]
param(
    [switch]$Publish,
    [string]$FixtureRoot,
    [string]$ReceiptPath,
    [ValidatePattern("^[0-9a-f]{12}$")]
    [string]$Nonce,
    [string]$FileZillaProfilePath = (Join-Path $env:APPDATA "FileZilla\sitemanager.xml"),
    [string]$NodeExecutablePath = $env:TINYRUSTLM_NODE_EXECUTABLE,
    [ValidateSet("none", "before-evidence", "lock-create-ambiguous", "lock-owner-substitution", "capability-rename", "guard-readback", "before-removal", "after-first-removal", "cleanup", "receipt-write")]
    [string]$FixtureFault = "none"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$repositoryRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$script:fixtureMode = -not [string]::IsNullOrWhiteSpace($FixtureRoot)
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

if (-not $script:fixtureMode) { Assert-CanonicalSourceAuthority }
Add-Type -AssemblyName System.Net.Http

$script:fixtureTargetRoot = $null
$script:fixtureAuthorityRoot = $null
$script:fixtureHttpsRoot = $null
$script:credential = $null
$script:ftpHost = $null
$script:ftpPort = 0
$script:ftpProtocol = $null
$script:ftpUser = $null
$script:ftpRemoteRoot = $null
$script:httpClient = $null
$script:phase = "local-preflight"
$script:lockAttempted = $false
$script:lockAcquired = $false
$script:lockOwnershipProven = $false
$script:lockDisposition = "not-attempted"
$script:lockOwnerToken = $null
$script:lockOwnerBytes = $null
$script:lockOwnerSha256 = $null
$script:lockOwnerMarkerRemoved = $false
$script:deletionStarted = $false
$script:guardReadbackProven = $false
$script:artifactsInstalled = 0
$script:installationRecords = @()
$script:readbackRequestCount = 0
$script:retiredResults = @()
$script:deploymentAuthority = $null
$script:transportAuthority = $null
$script:transportTupleSha256 = $null
$script:transportBindingSha256 = $null
$script:evidenceRoot = $null
$script:evidenceRootCreated = $false
$script:journalStartedPath = $null
$script:journalTerminalPath = $null
$script:journalReserved = $false
$script:terminalEvidenceWritten = $false

$origin = "https://tinyrustlm.mirust.com"
$profileName = "TinyRustLM.MiRust.com"
$lockPath = ".uai/source-retirement.lock"
$lockOwnerPath = "$lockPath/owner.json"
$goneBody = "This public source copy has been permanently retired.`n"
$goneBodyBytes = [Text.Encoding]::UTF8.GetBytes($goneBody)
$maximumControlBytes = 65536
$maximumReceiptBytes = 16384
$maximumAuthorityBytes = 2097152
$maximumRetiredTargetBytes = 8388608
$canonicalDeploymentReceiptPath = "deploy/receipts/site-deployment-20260830T014629Z.json"
$canonicalDeploymentReceiptSha256 = "e762a900aad256d5783ea5fbdec68307f95b08d4e0f1f76db6765329fa172cf2"
$canonicalDeploymentVersion = "1.8.2"
$canonicalDeploymentCommit = "2547720541dfb927a81a85ae3eac3222908b9771"
$canonicalDeploymentTree = "bc7b4a9d5c74e4f94fb7a168211a865fb099dadc"
$transportAuthorityRelativePath = "deploy/ftps-transport-authority.v1.json"
$canonicalTransportAuthoritySha256 = "87e40866f5828fc9b7b34cee422e48d53e3d47c12bda6855809f79e791cb3b37"
$retainedReportPaths = @(
    "docs/reports/analyzing-website-virality.md",
    "docs/reports/future-proof-native-html5-techniques.md",
    "docs/reports/innovative-vanilla-web-design.md",
    "docs/reports/mememtech-vanilla-web-architecture.md",
    "docs/reports/memory-systems-domains-research.md",
    "docs/reports/rust-wasm-neural-model-patterns.md",
    "docs/reports/tiny-language-models-for-rust-wasm.md",
    "docs/reports/tiny-language-models-for-wasm.md",
    "docs/reports/understanding-tinyrustlm-creation-and-purpose.md",
    "docs/reports/vanilla-js-future-proof-techniques.md"
)
$identityPaths = @(
    ".uai/.htaccess",
    ".uai/index.uai",
    ".uai/taboo.uai",
    ".uai/talisman.uai",
    ".uai/totem.uai",
    ".well-known/uaix-talisman.txt",
    "docs/reports/gguf-mirust-all-source-review-bundle.txt"
) + $retainedReportPaths + @("docs/runtime-portal/runtime-docs/workspace.uai")
$retiredPaths = @(
    "docs/reports/gguf-mirust-all-source-review-bundle.txt"
) + $retainedReportPaths + @(
    "docs/runtime-portal/runtime-docs/workspace.uai",
    ".uai/taboo.uai",
    ".uai/talisman.uai",
    ".uai/totem.uai"
)
$repositoryRetiredPaths = @(
    "docs/reports/gguf-mirust-all-source-review-bundle.txt",
    "docs/runtime-portal/runtime-docs/workspace.uai"
)
$retiredVariants = @()
foreach ($retiredPath in $retiredPaths) {
    $leaf = [IO.Path]::GetFileName($retiredPath)
    $parent = $retiredPath.Substring(0, $retiredPath.Length - $leaf.Length)
    $encodedLeaf = ("%{0:x2}{1}" -f ([int][char]$leaf[0]), $leaf.Substring(1)) -replace "\.", "%2E"
    $retiredVariants += @(
        "/$retiredPath",
        "/$($retiredPath.ToUpperInvariant())",
        "/$parent$encodedLeaf",
        "/$($retiredPath.Replace('/', '%2F'))"
    )
}
$artifactPaths = @(
    ".uai/.htaccess",
    ".uai/index.uai",
    ".well-known/uaix-talisman.txt",
    "docs/retired-source-copy-gone.txt",
    "docs/reports/.htaccess",
    "docs/runtime-portal/.htaccess",
    "docs/runtime-portal/runtime-docs/.htaccess",
    ".htaccess"
)

function Assert-RelativePath {
    param([Parameter(Mandatory)][string]$Path)

    if ($Path.Length -lt 1 -or $Path.Length -gt 256 -or
        $Path.StartsWith("/") -or $Path.StartsWith("\") -or
        $Path.Contains("\") -or $Path.Contains("//") -or
        $Path -match "(^|/)\.\.?(?:/|$)" -or
        $Path -notmatch "^[A-Za-z0-9._/-]+$") {
        throw "Source-retirement path is unsafe."
    }
}

function Get-Sha256Bytes {
    param([Parameter(Mandatory)][byte[]]$Bytes)

    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace("-", "").ToLowerInvariant()
    }
    finally { $sha.Dispose() }
}

function Get-ContainedPlainFileBytes {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][int64]$MaximumBytes
    )

    Assert-RelativePath -Path $RelativePath
    $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $rootItem = Get-Item -LiteralPath $resolvedRoot -Force
    if (-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Deployment authority root is not a plain directory."
    }
    $resolved = [IO.Path]::GetFullPath((Join-Path $resolvedRoot ($RelativePath -replace "/", "\")))
    if (-not $resolved.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Deployment authority path escaped its root."
    }
    $cursor = Split-Path -Parent $resolved
    while (-not [string]::Equals($cursor, $resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
        $directory = Get-Item -LiteralPath $cursor -Force
        if (-not $directory.PSIsContainer -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Deployment authority path contains a non-plain directory."
        }
        $parent = Split-Path -Parent $cursor
        if ([string]::Equals($parent, $cursor, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Deployment authority ancestry escaped its root."
        }
        $cursor = $parent
    }
    $item = Get-Item -LiteralPath $resolved -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $item.Length -lt 1 -or $item.Length -gt $MaximumBytes) {
        throw "Deployment authority file is not a bounded regular file."
    }
    return ,[IO.File]::ReadAllBytes($item.FullName)
}

function ConvertFrom-StrictJsonBytes {
    param([Parameter(Mandatory)][byte[]]$Bytes, [Parameter(Mandatory)][string]$Description)

    try {
        $encoding = [Text.UTF8Encoding]::new($false, $true)
        $text = $encoding.GetString($Bytes)
        return $text | ConvertFrom-Json
    }
    catch { throw "$Description is not strict bounded JSON." }
}

function Get-DeploymentAuthority {
    $script:phase = "deployment-identity"
    $authorityRoot = if ($script:fixtureMode) { $script:fixtureAuthorityRoot } else { $repositoryRoot }
    $manifestRelative = "deploy/site-deployment-manifest.v1.json"
    $manifestBytes = Get-ContainedPlainFileBytes -Root $authorityRoot -RelativePath $manifestRelative -MaximumBytes $maximumAuthorityBytes
    $manifest = ConvertFrom-StrictJsonBytes -Bytes $manifestBytes -Description "Deployment manifest"
    if ($manifest.schema -cne "tinyrustlm.mirust.site_deployment_manifest.v1" -or
        $manifest.site -cne "TinyRustLM.MiRust.com" -or
        $manifest.origin -cne $origin -or
        $manifest.transport_profile -cne $profileName -or $null -eq $manifest.last_verified_publication) {
        throw "Deployment manifest identity is invalid."
    }

    $last = $manifest.last_verified_publication
    $receiptRelative = [string]$last.receipt
    Assert-RelativePath -Path $receiptRelative
    if (-not $script:fixtureMode -and (
        $last.version -cne $canonicalDeploymentVersion -or
        $last.source_commit -cne $canonicalDeploymentCommit -or
        $last.source_tree -cne $canonicalDeploymentTree -or
        $receiptRelative -cne $canonicalDeploymentReceiptPath -or
        $last.receipt_sha256 -cne $canonicalDeploymentReceiptSha256)) {
        throw "Last-verified deployment identity drifted."
    }
    if ($script:fixtureMode -and (
        [string]$last.version -notmatch "^[A-Za-z0-9._-]{1,64}$" -or
        [string]$last.source_commit -notmatch "^[0-9a-f]{40}$" -or
        [string]$last.source_tree -notmatch "^[0-9a-f]{40}$" -or
        $receiptRelative -notmatch "^deploy/receipts/[A-Za-z0-9._-]+\.json$" -or
        [string]$last.receipt_sha256 -notmatch "^[0-9a-f]{64}$")) {
        throw "Fixture deployment identity is invalid."
    }

    $receiptBytes = Get-ContainedPlainFileBytes -Root $authorityRoot -RelativePath $receiptRelative -MaximumBytes $maximumAuthorityBytes
    $receiptSha256 = Get-Sha256Bytes -Bytes $receiptBytes
    if ($receiptSha256 -cne [string]$last.receipt_sha256) {
        throw "Last-verified deployment receipt bytes drifted."
    }
    $receipt = ConvertFrom-StrictJsonBytes -Bytes $receiptBytes -Description "Deployment receipt"
    if ($receipt.schema -cne "tinyrustlm.mirust.site_deployment_receipt.v1" -or
        $receipt.site -cne "TinyRustLM.MiRust.com" -or
        $receipt.origin -cne $origin -or
        $receipt.version -cne [string]$last.version -or
        $receipt.source_commit -cne [string]$last.source_commit -or
        $receipt.source_tree -cne [string]$last.source_tree -or
        $receipt.status -cne "published-and-readback-verified") {
        throw "Last-verified deployment receipt identity is invalid."
    }

    $files = @($receipt.files)
    if ($files.Count -lt $identityPaths.Count -or $files.Count -gt 512) {
        throw "Last-verified deployment inventory has invalid bounds."
    }
    $identities = @{}
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($file in $files) {
        $path = [string]$file.path
        if ([string]::IsNullOrWhiteSpace($path)) { throw "Deployment inventory path is invalid." }
        Assert-RelativePath -Path $path
        $bytes = [int64]$file.bytes
        $sha256 = [string]$file.sha256
        if (-not $seen.Add($path) -or $bytes -lt 1 -or $bytes -gt $maximumRetiredTargetBytes -or
            $sha256 -notmatch "^[0-9a-f]{64}$") {
            throw "Deployment inventory identity is invalid."
        }
        if ($identityPaths -ccontains $path) {
            $identities[$path] = [pscustomobject]@{ path = $path; bytes = $bytes; sha256 = $sha256 }
        }
    }
    if ($identities.Count -ne $identityPaths.Count) {
        throw "Deployment receipt does not contain the exact retirement identities."
    }

    if (-not $script:fixtureMode) {
        $expected = @{
            ".uai/.htaccess" = @(256, "4268ee353e8ae2a97969cb8e03f17d6ad5d0b74b5c93c61a31f547038780c54f")
            ".uai/index.uai" = @(1408, "d42499579ae930fd1904420804ecd8e52bd8c3152c21061c54046f528a5d9409")
            ".uai/taboo.uai" = @(4515, "e9d87bd04351dbe52d2804ef7213b199fa2e2b7f1c95a8dc0753d0bccbd7bf70")
            ".uai/talisman.uai" = @(734, "78c3436b437cd40b106789c985b8cc033502ca38a710e944d34d17ba219ec96e")
            ".uai/totem.uai" = @(2870, "85e283635278191cca992d3cb044223c261d1d393335c95c202ec119602d96ba")
            ".well-known/uaix-talisman.txt" = @(3268, "da4570444088642c9e644287b56cefe252244955b65fe1d280e7a5f180f323c8")
            "docs/reports/gguf-mirust-all-source-review-bundle.txt" = @(4915911, "8be2f5781fbc3db4ae5c5af6a167b5dd16b6e19df6ecbdcd82b87367b56c6de0")
            "docs/reports/analyzing-website-virality.md" = @(62253, "5cdb3c8c9fa714af0c44b48ec58b3c885846d5c8d7b1e5dde869442b83da95ef")
            "docs/reports/future-proof-native-html5-techniques.md" = @(53751, "a152a89b4575ddb990ddb5300dae0ac44bc424abded40c9adb7ca87045461879")
            "docs/reports/innovative-vanilla-web-design.md" = @(47461, "fe68269f39258fa1e3bfecb7f78c153f4ca24c0f08432d3f193f91087b12122c")
            "docs/reports/mememtech-vanilla-web-architecture.md" = @(42941, "4e3acaa0d568c201c56e8f74e0016004743d04e553b9aec8e83152e0f8b4e47a")
            "docs/reports/memory-systems-domains-research.md" = @(39530, "b400312f9feb5f5d5d2bf0c77b221b925b7ac091bc618e1b6964d38885d8c9b9")
            "docs/reports/rust-wasm-neural-model-patterns.md" = @(69793, "53e988fbcdd51a06a6155a8293ca85113543f20d9f78af52ee50997b23e5f618")
            "docs/reports/tiny-language-models-for-rust-wasm.md" = @(44102, "37d6b47ed4284f65c591921f653f3aa4e17672593ae84c09c84e4222fc808ae9")
            "docs/reports/tiny-language-models-for-wasm.md" = @(46105, "b823a12562f6db288c6b16a38a6a9a8c6dd2af8c02f783bbf34e3c54836ff6fb")
            "docs/reports/understanding-tinyrustlm-creation-and-purpose.md" = @(31890, "69a94b184f4876b293ef268f22df5db63f1dff5413afef03f7a9c6bab397440d")
            "docs/reports/vanilla-js-future-proof-techniques.md" = @(47621, "5bcc36711c08d1072c857b01e025d7fff946615349bdeeb340e70fa8677f92b3")
            "docs/runtime-portal/runtime-docs/workspace.uai" = @(74217, "5d8b08c561d6660d6eb8ace22b30baafc2ed8d9e8ec5a27334b304038d4480ff")
        }
        foreach ($path in $identityPaths) {
            if ([int64]$identities[$path].bytes -ne [int64]$expected[$path][0] -or
                [string]$identities[$path].sha256 -cne [string]$expected[$path][1]) {
                throw "Canonical retirement identity drifted."
            }
        }
    }

    return [pscustomobject]@{
        receipt_sha256 = $receiptSha256
        version = [string]$receipt.version
        source_commit = [string]$receipt.source_commit
        source_tree = [string]$receipt.source_tree
        files = $identities
    }
}

function Get-TransportAuthority {
    $script:phase = "transport-authority"
    $authorityRoot = if ($script:fixtureMode) { $script:fixtureAuthorityRoot } else { $repositoryRoot }
    $bytes = Get-ContainedPlainFileBytes -Root $authorityRoot -RelativePath $transportAuthorityRelativePath -MaximumBytes 4096
    $sha256 = Get-Sha256Bytes -Bytes $bytes
    if (-not $script:fixtureMode -and $sha256 -cne $canonicalTransportAuthoritySha256) {
        throw "Checked-in FTPS transport authority bytes drifted."
    }
    $authority = ConvertFrom-StrictJsonBytes -Bytes $bytes -Description "FTPS transport authority"
    $expectedProperties = @(
        "schema", "site", "origin", "profile_name", "tuple_format", "status", "tuple_sha256", "contains_secrets"
    )
    $properties = @($authority.PSObject.Properties.Name)
    if ($properties.Count -ne $expectedProperties.Count -or
        @($expectedProperties | Where-Object { $properties -cnotcontains $_ }).Count -ne 0 -or
        $authority.schema -cne "tinyrustlm.mirust.ftps_transport_authority.v1" -or
        $authority.site -cne "TinyRustLM.MiRust.com" -or
        $authority.origin -cne $origin -or
        $authority.profile_name -cne $profileName -or
        $authority.tuple_format -cne "tinyrustlm.mirust.ftps_transport_tuple.v1" -or
        $authority.contains_secrets -ne $false) {
        throw "Checked-in FTPS transport authority identity is invalid."
    }
    if ($authority.status -cne "active-bound" -or [string]$authority.tuple_sha256 -notmatch "^[0-9a-f]{64}$") {
        throw "Production FTPS transport authority is blocked pending an independently attested secret-free tuple digest."
    }
    return [pscustomobject]@{
        sha256 = $sha256
        tuple_sha256 = [string]$authority.tuple_sha256
    }
}

function Get-LocalArtifactBytes {
    param([Parameter(Mandatory)][string]$RelativePath)

    Assert-RelativePath -Path $RelativePath
    $fullPath = [IO.Path]::GetFullPath((Join-Path $repositoryRoot ($RelativePath -replace "/", "\")))
    if (-not $fullPath.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Source-retirement artifact escaped the repository."
    }
    $item = Get-Item -LiteralPath $fullPath -Force
    if (-not $item.PSIsContainer -and
        ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -and
        $item.Length -gt 0 -and $item.Length -le $maximumControlBytes) {
        $bytes = [IO.File]::ReadAllBytes($item.FullName)
        return ,$bytes
    }
    throw "Source-retirement artifact is not a bounded regular file: $RelativePath"
}

function Assert-ExactLine {
    param([string]$Text, [string]$Line, [string]$Description)

    $count = @($Text -split "`n" | Where-Object { $_ -ceq $Line }).Count
    if ($count -ne 1) { throw "Apache guard is missing one exact $Description directive." }
}

function Assert-LocalArtifacts {
    $summaries = @()
    foreach ($relative in $artifactPaths) {
        $bytes = Get-LocalArtifactBytes -RelativePath $relative
        if ($bytes -contains 13) { throw "Public retirement controls must use canonical LF bytes: $relative" }
        $summaries += [ordered]@{
            path = $relative
            bytes = [int64]$bytes.Length
            sha256 = Get-Sha256Bytes -Bytes $bytes
        }
    }

    if ($goneBodyBytes.Length -ne 54) { throw "The fixed Gone body identity is invalid." }
    $body = Get-LocalArtifactBytes -RelativePath "docs/retired-source-copy-gone.txt"
    if (-not [Linq.Enumerable]::SequenceEqual([byte[]]$body, [byte[]]$goneBodyBytes)) {
        throw "The Gone response body is not the exact approved 54-byte body."
    }

    $root = [Text.Encoding]::UTF8.GetString((Get-LocalArtifactBytes -RelativePath ".htaccess"))
    Assert-ExactLine -Text $root -Line "ErrorDocument 410 /docs/retired-source-copy-gone.txt" -Description "ErrorDocument"
    $uaiRule = "RewriteRule ^\.uai/(?!index\.uai$|long-term-memory\.uai$).+ - [G,NC]"
    $reportPattern = "(?:analyzing-website-virality\.md|future-proof-native-html5-techniques\.md|gguf-mirust-all-source-review-bundle\.txt|innovative-vanilla-web-design\.md|mememtech-vanilla-web-architecture\.md|memory-systems-domains-research\.md|rust-wasm-neural-model-patterns\.md|tiny-language-models-for-rust-wasm\.md|tiny-language-models-for-wasm\.md|understanding-tinyrustlm-creation-and-purpose\.md|vanilla-js-future-proof-techniques\.md)"
    $reportRule = "RewriteRule ^docs/reports/${reportPattern}$ - [G,NC]"
    $archiveRule = "RewriteRule ^docs/runtime-portal/(?!index\.md$).+ - [G,NC]"
    Assert-ExactLine -Text $root -Line $uaiRule -Description "private UAI retirement"
    Assert-ExactLine -Text $root -Line $reportRule -Description "report retirement"
    Assert-ExactLine -Text $root -Line $archiveRule -Description "raw archive retirement"
    $bypassOffset = $root.IndexOf("RewriteCond %{REQUEST_FILENAME} -f [OR]", [StringComparison]::Ordinal)
    if ($bypassOffset -lt 0 -or
        $root.IndexOf($uaiRule, [StringComparison]::Ordinal) -gt $bypassOffset -or
        $root.IndexOf($reportRule, [StringComparison]::Ordinal) -gt $bypassOffset -or
        $root.IndexOf($archiveRule, [StringComparison]::Ordinal) -gt $bypassOffset) {
        throw "Apache retirement guards must precede physical-file bypass."
    }
    foreach ($line in @(
        "Header onsuccess unset Location",
        "Header always unset Location",
        "Header always set Cache-Control `"no-store`"",
        "Header always set X-Robots-Tag `"noindex, nofollow`"",
        "Header always set X-Content-Type-Options `"nosniff`"",
        "Header always set Content-Type `"text/plain; charset=utf-8`""
    )) {
        Assert-ExactLine -Text $root -Line $line -Description "terminal response header"
    }

    $expectedReportGuard = (@(
        "ErrorDocument 410 /docs/retired-source-copy-gone.txt",
        "",
        "<IfModule mod_rewrite.c>",
        "RewriteEngine On",
        "RewriteRule ^${reportPattern}$ - [G,NC]",
        "</IfModule>"
    ) -join "`n") + "`n"
    $expectedWorkspaceGuard = (@(
        "ErrorDocument 410 /docs/retired-source-copy-gone.txt",
        "",
        "<IfModule mod_rewrite.c>",
        "RewriteEngine On",
        "RewriteRule ^workspace\.uai$ - [G,NC]",
        "</IfModule>"
    ) -join "`n") + "`n"
    $expectedArchiveGuard = (@(
        "ErrorDocument 410 /docs/retired-source-copy-gone.txt",
        "",
        "<IfModule mod_rewrite.c>",
        "RewriteEngine On",
        "RewriteRule ^(?!index\.md$).+ - [G,NC]",
        "</IfModule>"
    ) -join "`n") + "`n"
    $expectedUaiGuard = (@(
        "Options -Indexes",
        "AddType text/plain .uai",
        "",
        "<FilesMatch `"^(index|long-term-memory)\.uai$`">",
        "  Require all granted",
        "</FilesMatch>",
        "",
        "<FilesMatch `"^(?!(index|long-term-memory)\.uai$).+`">",
        "  Require all denied",
        "</FilesMatch>"
    ) -join "`n") + "`n"
    $reportGuard = [Text.Encoding]::UTF8.GetString((Get-LocalArtifactBytes -RelativePath "docs/reports/.htaccess"))
    $archiveGuard = [Text.Encoding]::UTF8.GetString((Get-LocalArtifactBytes -RelativePath "docs/runtime-portal/.htaccess"))
    $workspaceGuard = [Text.Encoding]::UTF8.GetString((Get-LocalArtifactBytes -RelativePath "docs/runtime-portal/runtime-docs/.htaccess"))
    $uaiGuard = [Text.Encoding]::UTF8.GetString((Get-LocalArtifactBytes -RelativePath ".uai/.htaccess"))
    if ($reportGuard -cne $expectedReportGuard -or $archiveGuard -cne $expectedArchiveGuard -or
        $workspaceGuard -cne $expectedWorkspaceGuard -or $uaiGuard -cne $expectedUaiGuard) {
        throw "Directory-local Apache guards are not byte-exact approved rules."
    }

    foreach ($relative in @(".uai/index.uai", ".well-known/uaix-talisman.txt")) {
        $publicText = [Text.Encoding]::UTF8.GetString((Get-LocalArtifactBytes -RelativePath $relative))
        foreach ($forbidden in @("taboo.uai", "talisman.uai", "totem.uai", "workspace.uai", "E:\", "D:\")) {
            if ($publicText.IndexOf($forbidden, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                throw "Public retirement pointer contains private governance material: $relative"
            }
        }
    }

    foreach ($retired in $repositoryRetiredPaths) {
        $fullPath = Join-Path $repositoryRoot ($retired -replace "/", "\")
        if (Test-Path -LiteralPath $fullPath) {
            throw "A retired source copy has been restored in the repository."
        }
    }
    return $summaries
}

function Read-FileZillaPathInteger {
    param([Parameter(Mandatory)][string]$Text, [Parameter(Mandatory)][ref]$Offset, [bool]$First)

    $position = [int]$Offset.Value
    if (-not $First) {
        if ($position -ge $Text.Length -or $Text[$position] -cne " ") {
            throw "FileZilla RemoteDir is not canonical."
        }
        $position += 1
    }
    $start = $position
    while ($position -lt $Text.Length -and $Text[$position] -ge "0" -and $Text[$position] -le "9") {
        $position += 1
    }
    $value = 0
    if ($position -eq $start -or -not [int]::TryParse($Text.Substring($start, $position - $start), [ref]$value)) {
        throw "FileZilla RemoteDir contains an invalid length."
    }
    $Offset.Value = $position
    return $value
}

function Read-FileZillaPathPayload {
    param([Parameter(Mandatory)][string]$Text, [Parameter(Mandatory)][ref]$Offset, [int]$Length)

    $position = [int]$Offset.Value
    if ($Length -eq 0) { return "" }
    if ($Length -lt 0 -or $Length -gt 128 -or $position -ge $Text.Length -or $Text[$position] -cne " ") {
        throw "FileZilla RemoteDir payload is invalid."
    }
    $position += 1
    if ($position + $Length -gt $Text.Length) { throw "FileZilla RemoteDir payload is truncated." }
    $value = $Text.Substring($position, $Length)
    $Offset.Value = $position + $Length
    return $value
}

function ConvertFrom-FileZillaRemoteDir {
    param([Parameter(Mandatory)][string]$Value)

    if ($Value.Length -lt 3 -or $Value.Length -gt 512 -or $Value.Contains("`r") -or $Value.Contains("`n")) {
        throw "FileZilla RemoteDir has invalid bounds."
    }
    $offset = 0
    $serverType = Read-FileZillaPathInteger -Text $Value -Offset ([ref]$offset) -First $true
    $prefixLength = Read-FileZillaPathInteger -Text $Value -Offset ([ref]$offset) -First $false
    $prefix = Read-FileZillaPathPayload -Text $Value -Offset ([ref]$offset) -Length $prefixLength
    if ($serverType -ne 1 -or ($prefix.Length -ne 0 -and $prefix -cne "/")) {
        throw "FileZilla RemoteDir is not a bounded Unix path."
    }
    $segments = @()
    while ($offset -lt $Value.Length) {
        if ($segments.Count -ge 16) { throw "FileZilla RemoteDir has too many segments." }
        $length = Read-FileZillaPathInteger -Text $Value -Offset ([ref]$offset) -First $false
        $segment = Read-FileZillaPathPayload -Text $Value -Offset ([ref]$offset) -Length $length
        if ($segment -notmatch "^[A-Za-z0-9._-]{1,128}$" -or $segment -ceq "." -or $segment -ceq "..") {
            throw "FileZilla RemoteDir segment is unsafe."
        }
        $segments += $segment
    }
    $remoteRoot = $segments -join "/"
    if ($remoteRoot.Length -gt 240) { throw "FileZilla RemoteDir exceeds its path bound." }
    return $remoteRoot
}

function Get-BoundRemotePath {
    param([Parameter(Mandatory)][string]$RelativePath)

    Assert-RelativePath -Path $RelativePath
    if ($null -eq $script:ftpRemoteRoot) { throw "FTPS RemoteDir is not bound." }
    $bound = if ([string]::IsNullOrEmpty($script:ftpRemoteRoot)) {
        $RelativePath
    }
    else { "$($script:ftpRemoteRoot)/$RelativePath" }
    Assert-RelativePath -Path $bound
    return $bound
}

function Get-BoundRemoteRenamePath {
    param([Parameter(Mandatory)][string]$RelativePath)

    $bound = Get-BoundRemotePath -RelativePath $RelativePath
    $encoded = (($bound -split "/") | ForEach-Object { [Uri]::EscapeDataString($_) }) -join "/"
    return "/$encoded"
}

function Resolve-FixturePath {
    param([Parameter(Mandatory)][string]$RelativePath)

    $bound = Get-BoundRemotePath -RelativePath $RelativePath
    $fullPath = [IO.Path]::GetFullPath((Join-Path $script:fixtureTargetRoot ($bound -replace "/", "\")))
    if (-not $fullPath.StartsWith($script:fixtureTargetRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Fixture path escaped the owned fixture root."
    }
    return $fullPath
}

function Assert-PlainFixtureTree {
    $rootItem = Get-Item -LiteralPath $script:fixtureTargetRoot -Force
    if (-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Fixture root must be a plain directory."
    }
    $marker = Join-Path $script:fixtureTargetRoot ".source-retirement-fixture-root"
    if (-not (Test-Path -LiteralPath $marker -PathType Leaf) -or
        [IO.File]::ReadAllText($marker, [Text.Encoding]::UTF8) -cne "tinyrustlm-source-retirement-fixture-v1`n") {
        throw "Fixture root is missing its exact ownership marker."
    }
    foreach ($item in @(Get-ChildItem -LiteralPath $script:fixtureTargetRoot -Recurse -Force)) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Fixture tree must not contain links or reparse points."
        }
    }
}

function Get-EncodedRemotePath {
    param([Parameter(Mandatory)][string]$RemotePath)

    Assert-RelativePath -Path $RemotePath
    return (($RemotePath -split "/") | ForEach-Object { [Uri]::EscapeDataString($_) }) -join "/"
}

function New-FtpRequest {
    param([Parameter(Mandatory)][string]$RemotePath, [Parameter(Mandatory)][string]$Method)

    $bound = Get-BoundRemotePath -RelativePath $RemotePath
    $encoded = Get-EncodedRemotePath -RemotePath $bound
    $uri = [Uri]("ftp://{0}:{1}/{2}" -f $script:ftpHost, $script:ftpPort, $encoded)
    $request = [Net.FtpWebRequest]::Create($uri)
    $request.Method = $Method
    $request.EnableSsl = $true
    $request.UseBinary = $true
    $request.UsePassive = $true
    $request.KeepAlive = $false
    $request.Timeout = 120000
    $request.ReadWriteTimeout = 120000
    $request.Credentials = $script:credential
    return $request
}

function Test-FileUnavailableError {
    param([Exception]$Exception)

    $current = $Exception
    while ($null -ne $current.InnerException) { $current = $current.InnerException }
    return $current -is [Net.WebException] -and
        $current.Response -is [Net.FtpWebResponse] -and
        [int]$current.Response.StatusCode -eq 550
}

function Get-TargetSize {
    param([Parameter(Mandatory)][string]$RelativePath)

    if ($script:fixtureMode) {
        $fullPath = Resolve-FixturePath -RelativePath $RelativePath
        if (-not (Test-Path -LiteralPath $fullPath)) { return [int64]-1 }
        $item = Get-Item -LiteralPath $fullPath -Force
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Fixture target is not a regular file."
        }
        return [int64]$item.Length
    }

    try {
        $request = New-FtpRequest -RemotePath $RelativePath -Method ([Net.WebRequestMethods+Ftp]::GetFileSize)
        $response = $request.GetResponse()
        try { return [int64]$response.ContentLength } finally { $response.Dispose() }
    }
    catch {
        if (Test-FileUnavailableError -Exception $_.Exception) { return [int64]-1 }
        throw
    }
}

function Get-TargetBytes {
    param([Parameter(Mandatory)][string]$RelativePath, [int64]$MaximumBytes = $maximumControlBytes)

    $size = Get-TargetSize -RelativePath $RelativePath
    if ($size -lt 0) { return $null }
    if ($size -gt $MaximumBytes) { throw "Remote control artifact exceeds its read bound." }
    if ($script:fixtureMode) {
        $bytes = [IO.File]::ReadAllBytes((Resolve-FixturePath -RelativePath $RelativePath))
        return ,$bytes
    }

    $request = New-FtpRequest -RemotePath $RelativePath -Method ([Net.WebRequestMethods+Ftp]::DownloadFile)
    $response = $request.GetResponse()
    $stream = $response.GetResponseStream()
    $memory = [IO.MemoryStream]::new()
    $buffer = New-Object byte[] 8192
    try {
        while ($true) {
            $read = $stream.Read($buffer, 0, $buffer.Length)
            if ($read -eq 0) { break }
            $memory.Write($buffer, 0, $read)
            if ($memory.Length -gt $MaximumBytes) { throw "Remote control artifact exceeded its read bound." }
        }
        $bytes = $memory.ToArray()
        if ($bytes.Length -ne $size) { throw "Remote control artifact changed while being read." }
        return ,$bytes
    }
    finally {
        $memory.Dispose()
        $stream.Dispose()
        $response.Dispose()
    }
}

function Test-TargetIdentity {
    param([Parameter(Mandatory)][string]$RelativePath, [Parameter(Mandatory)][byte[]]$Bytes)

    $actual = Get-TargetBytes -RelativePath $RelativePath -MaximumBytes ([Math]::Max(1, $Bytes.Length))
    return $null -ne $actual -and
        $actual.Length -eq $Bytes.Length -and
        (Get-Sha256Bytes -Bytes $actual) -ceq (Get-Sha256Bytes -Bytes $Bytes)
}

function Test-ExactLockOwnership {
    if ($null -eq $script:lockOwnerBytes -or $script:lockOwnerBytes.Length -lt 1) { return $false }
    return Test-TargetIdentity -RelativePath $lockOwnerPath -Bytes $script:lockOwnerBytes
}

function Assert-ExactLockOwnership {
    $proven = $false
    try { $proven = Test-ExactLockOwnership }
    catch {
        $script:lockOwnershipProven = $false
        $script:lockAcquired = $false
        $script:lockDisposition = "ownership-proof-observation-unproven"
        throw
    }
    if (-not $proven) {
        $script:lockOwnershipProven = $false
        $script:lockAcquired = $false
        $script:lockDisposition = "ownership-proof-absent-or-drifted"
        throw "Remote retirement lock ownership is not proven by the exact owner marker bytes."
    }
}

function Test-TargetDirectory {
    param([Parameter(Mandatory)][string]$RelativePath)

    Assert-RelativePath -Path $RelativePath
    if ($script:fixtureMode) {
        $fullPath = Resolve-FixturePath -RelativePath $RelativePath
        return Test-Path -LiteralPath $fullPath -PathType Container
    }
    try {
        $request = New-FtpRequest -RemotePath $RelativePath -Method ([Net.WebRequestMethods+Ftp]::ListDirectory)
        $response = $request.GetResponse()
        $response.Dispose()
        return $true
    }
    catch {
        if (Test-FileUnavailableError -Exception $_.Exception) { return $false }
        throw
    }
}

function New-TargetDirectoryCreateOnly {
    param([Parameter(Mandatory)][string]$RelativePath)

    if (Test-TargetDirectory -RelativePath $RelativePath) { throw "Remote create-only directory is occupied." }
    if ($script:fixtureMode) {
        $fullPath = Resolve-FixturePath -RelativePath $RelativePath
        [IO.Directory]::CreateDirectory($fullPath) | Out-Null
    }
    else {
        $request = New-FtpRequest -RemotePath $RelativePath -Method ([Net.WebRequestMethods+Ftp]::MakeDirectory)
        $response = $request.GetResponse()
        $response.Dispose()
    }
    if ($FixtureFault -ceq "lock-create-ambiguous" -and $RelativePath -ceq $lockPath) {
        throw "Injected ambiguous lock-creation response."
    }
    if (-not (Test-TargetDirectory -RelativePath $RelativePath)) {
        throw "Remote create-only directory did not commit."
    }
}

function Remove-TargetDirectory {
    param([Parameter(Mandatory)][string]$RelativePath)

    if (-not (Test-TargetDirectory -RelativePath $RelativePath)) { return }
    if ($script:fixtureMode) {
        [IO.Directory]::Delete((Resolve-FixturePath -RelativePath $RelativePath), $false)
    }
    else {
        $request = New-FtpRequest -RemotePath $RelativePath -Method ([Net.WebRequestMethods+Ftp]::RemoveDirectory)
        $response = $request.GetResponse()
        $response.Dispose()
    }
    if (Test-TargetDirectory -RelativePath $RelativePath) { throw "Remote directory removal did not commit." }
}

function Remove-TargetFile {
    param([Parameter(Mandatory)][string]$RelativePath)

    if ((Get-TargetSize -RelativePath $RelativePath) -lt 0) { return }
    if ($script:fixtureMode) {
        [IO.File]::Delete((Resolve-FixturePath -RelativePath $RelativePath))
    }
    else {
        $request = New-FtpRequest -RemotePath $RelativePath -Method ([Net.WebRequestMethods+Ftp]::DeleteFile)
        $response = $request.GetResponse()
        $response.Dispose()
    }
    if ((Get-TargetSize -RelativePath $RelativePath) -ge 0) { throw "Remote file removal did not commit." }
}

function Send-TargetFileCreateOnly {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][byte[]]$Bytes,
        [switch]$RetainOnAmbiguity
    )

    if ($Bytes.Length -lt 1 -or $Bytes.Length -gt $maximumControlBytes -or
        (Get-TargetSize -RelativePath $RelativePath) -ge 0) {
        throw "Remote create-only file path is occupied or invalid."
    }
    if ($script:fixtureMode) {
        $stream = [IO.File]::Open((Resolve-FixturePath -RelativePath $RelativePath), [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $stream.Write($Bytes, 0, $Bytes.Length); $stream.Flush() } finally { $stream.Dispose() }
    }
    else {
        $failure = $null
        try {
            $request = New-FtpRequest -RemotePath $RelativePath -Method ([Net.WebRequestMethods+Ftp]::UploadFile)
            $request.ContentLength = $Bytes.Length
            $stream = $request.GetRequestStream()
            try { $stream.Write($Bytes, 0, $Bytes.Length); $stream.Flush() } finally { $stream.Dispose() }
            $response = $request.GetResponse()
            $response.Dispose()
        }
        catch { $failure = $_.Exception }
        if ($null -ne $failure -and -not (Test-TargetIdentity -RelativePath $RelativePath -Bytes $Bytes)) {
            if (-not $RetainOnAmbiguity) {
                try { Remove-TargetFile -RelativePath $RelativePath } catch { }
            }
            throw $failure
        }
    }
    if (-not (Test-TargetIdentity -RelativePath $RelativePath -Bytes $Bytes)) {
        throw "Remote create-only file identity did not commit."
    }
}

function Move-TargetFileReplacing {
    param([Parameter(Mandatory)][string]$SourcePath, [Parameter(Mandatory)][string]$TargetPath)

    Assert-RelativePath -Path $SourcePath
    Assert-RelativePath -Path $TargetPath
    if ((Get-TargetSize -RelativePath $SourcePath) -lt 0) { throw "Remote rename source is absent." }
    if ($script:fixtureMode) {
        $source = Resolve-FixturePath -RelativePath $SourcePath
        $target = Resolve-FixturePath -RelativePath $TargetPath
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            $replacementBackup = "$source.fixture-replaced-backup"
            if (Test-Path -LiteralPath $replacementBackup) { throw "Fixture atomic-replacement backup is occupied." }
            [IO.File]::Replace($source, $target, $replacementBackup)
            [IO.File]::Delete($replacementBackup)
        }
        else { [IO.File]::Move($source, $target) }
    }
    else {
        $request = New-FtpRequest -RemotePath $SourcePath -Method ([Net.WebRequestMethods+Ftp]::Rename)
        $request.RenameTo = Get-BoundRemoteRenamePath -RelativePath $TargetPath
        $response = $request.GetResponse()
        $response.Dispose()
    }
    if ((Get-TargetSize -RelativePath $SourcePath) -ge 0) { throw "Remote rename source remains present." }
}

function Assert-FixturePrivateNamespace {
    param([Parameter(Mandatory)][string]$RequestPath)

    $allowedRequestPaths = @(
        "/.uai/source-retirement.lock/preflight.bin",
        "/.uai/source-retirement.lock/cap-source/probe.bin"
    )
    if ($allowedRequestPaths -cnotcontains $RequestPath) {
        throw "Fixture private namespace probe path is not exact."
    }
    $guardPath = Resolve-FixturePath -RelativePath ".uai/.htaccess"
    if (-not (Test-Path -LiteralPath $guardPath -PathType Leaf)) {
        throw "Fixture private namespace guard is absent."
    }
    $guard = [IO.File]::ReadAllText($guardPath, [Text.Encoding]::UTF8)
    if (-not $guard.Contains('<FilesMatch "^(index|long-term-memory)\.uai$">') -or
        -not $guard.Contains('<FilesMatch "^(?!(index|long-term-memory)\.uai$).+">') -or
        @($guard -split "`n" | Where-Object { $_.TrimEnd("`r") -ceq "  Require all granted" }).Count -ne 1 -or
        @($guard -split "`n" | Where-Object { $_.TrimEnd("`r") -ceq "  Require all denied" }).Count -ne 1 -or
        $guard -match "source-retirement") {
        throw "Fixture private namespace is not fail-closed for retirement controls."
    }
}

function Read-BoundedHttpBody {
    param([Parameter(Mandatory)][Net.Http.HttpResponseMessage]$Response, [Parameter(Mandatory)][int]$MaximumBytes)

    $stream = $Response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    $memory = [IO.MemoryStream]::new()
    $buffer = New-Object byte[] 256
    try {
        while ($true) {
            $read = $stream.Read($buffer, 0, $buffer.Length)
            if ($read -eq 0) { break }
            $memory.Write($buffer, 0, $read)
            if ($memory.Length -gt $MaximumBytes) { throw "HTTPS response exceeded its body bound." }
        }
        return ,$memory.ToArray()
    }
    finally { $memory.Dispose(); $stream.Dispose() }
}

function Assert-NoLocation {
    param([Parameter(Mandatory)][Net.Http.HttpResponseMessage]$Response)

    if ($null -ne $Response.Headers.Location -or $Response.Headers.Contains("Location")) {
        throw "HTTPS response returned a forbidden Location header."
    }
}

function Assert-PrivateNamespaceReadback {
    param([Parameter(Mandatory)][string]$RequestPath)

    if ($script:fixtureMode) { Assert-FixturePrivateNamespace -RequestPath $RequestPath; return }
    foreach ($method in @([Net.Http.HttpMethod]::Head, [Net.Http.HttpMethod]::Get)) {
        $request = [Net.Http.HttpRequestMessage]::new($method, "$origin$RequestPath")
        $response = $script:httpClient.SendAsync($request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        try {
            if ([int]$response.StatusCode -notin @(403, 404)) { throw "Private control namespace is web-visible." }
            Assert-NoLocation -Response $response
            $body = Read-BoundedHttpBody -Response $response -MaximumBytes 4096
            if ($method -eq [Net.Http.HttpMethod]::Head -and $body.Length -ne 0) {
                throw "Private namespace HEAD response included a body."
            }
        }
        finally { $response.Dispose(); $request.Dispose() }
    }
}

function Get-HttpsIdentityBytes {
    param([Parameter(Mandatory)][string]$RelativePath, [Parameter(Mandatory)][int64]$MaximumBytes)

    Assert-RelativePath -Path $RelativePath
    if ($script:fixtureMode) {
        return ,(Get-ContainedPlainFileBytes -Root $script:fixtureHttpsRoot -RelativePath $RelativePath -MaximumBytes $MaximumBytes)
    }
    $encoded = Get-EncodedRemotePath -RemotePath $RelativePath
    $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, "$origin/$encoded")
    $response = $script:httpClient.SendAsync($request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    try {
        if ([int]$response.StatusCode -ne 200) { throw "HTTPS site-identity artifact is unavailable." }
        Assert-NoLocation -Response $response
        if ($null -ne $response.Content.Headers.ContentLength -and
            [int64]$response.Content.Headers.ContentLength -gt $MaximumBytes) {
            throw "HTTPS site-identity artifact exceeds its bound."
        }
        return ,(Read-BoundedHttpBody -Response $response -MaximumBytes ([int]$MaximumBytes))
    }
    finally { $response.Dispose(); $request.Dispose() }
}

function Assert-ExpectedIdentityBytes {
    param([Parameter(Mandatory)][byte[]]$Bytes, [Parameter(Mandatory)][object]$Identity)

    if ($Bytes.Length -ne [int64]$Identity.bytes -or
        (Get-Sha256Bytes -Bytes $Bytes) -cne [string]$Identity.sha256) {
        throw "Selected remote site identity does not match the immutable deployment receipt."
    }
}

function Get-ExpectedTargetBytes {
    param([Parameter(Mandatory)][string]$RelativePath)

    $identity = $script:deploymentAuthority.files[$RelativePath]
    if ($null -eq $identity) { throw "Retirement target lacks an immutable deployment identity." }
    $bytes = Get-TargetBytes -RelativePath $RelativePath -MaximumBytes ([int64]$identity.bytes)
    if ($null -eq $bytes) { throw "Immutable retirement target is absent before mutation." }
    Assert-ExpectedIdentityBytes -Bytes $bytes -Identity $identity
    return ,$bytes
}

function Assert-RetiredTargetIdentities {
    foreach ($relative in $retiredPaths) {
        $null = Get-ExpectedTargetBytes -RelativePath $relative
    }
}

function Get-TransportBindingSha256 {
    $talisman = $script:deploymentAuthority.files[".well-known/uaix-talisman.txt"]
    $publicIndex = $script:deploymentAuthority.files[".uai/index.uai"]
    $material = (@(
        "tinyrustlm.mirust.retirement.transport.v2",
        "transport_authority_sha256=$($script:transportAuthority.sha256)",
        "transport_tuple_sha256=$($script:transportTupleSha256)",
        "deployment_receipt_sha256=$($script:deploymentAuthority.receipt_sha256)",
        "talisman_sha256=$($talisman.sha256)",
        "public_index_sha256=$($publicIndex.sha256)"
    ) -join "`n") + "`n"
    return Get-Sha256Bytes -Bytes ([Text.Encoding]::UTF8.GetBytes($material))
}

function Assert-RemoteSiteIdentity {
    $script:phase = "remote-site-identity"
    $guardIdentity = $script:deploymentAuthority.files[".uai/.htaccess"]
    $guardBytes = Get-TargetBytes -RelativePath ".uai/.htaccess" -MaximumBytes ([int64]$guardIdentity.bytes)
    if ($null -eq $guardBytes) { throw "Selected FTPS root lacks the immutable UAI access policy." }
    Assert-ExpectedIdentityBytes -Bytes $guardBytes -Identity $guardIdentity

    $talismanIdentity = $script:deploymentAuthority.files[".well-known/uaix-talisman.txt"]
    $httpsTalisman = Get-HttpsIdentityBytes -RelativePath ".well-known/uaix-talisman.txt" -MaximumBytes ([int64]$talismanIdentity.bytes)
    Assert-ExpectedIdentityBytes -Bytes $httpsTalisman -Identity $talismanIdentity
    $ftpsTalisman = Get-TargetBytes -RelativePath ".well-known/uaix-talisman.txt" -MaximumBytes ([int64]$talismanIdentity.bytes)
    if ($null -eq $ftpsTalisman) { throw "Selected FTPS root lacks the immutable public talisman." }
    Assert-ExpectedIdentityBytes -Bytes $ftpsTalisman -Identity $talismanIdentity
    if (-not [Linq.Enumerable]::SequenceEqual([byte[]]$httpsTalisman, [byte[]]$ftpsTalisman)) {
        throw "HTTPS and FTPS talisman bytes do not identify the same site."
    }

    $publicIndexIdentity = $script:deploymentAuthority.files[".uai/index.uai"]
    $ftpsPublicIndex = Get-TargetBytes -RelativePath ".uai/index.uai" -MaximumBytes ([int64]$publicIndexIdentity.bytes)
    if ($null -eq $ftpsPublicIndex) { throw "Selected FTPS root lacks the immutable public UAI index." }
    Assert-ExpectedIdentityBytes -Bytes $ftpsPublicIndex -Identity $publicIndexIdentity
    $httpsPublicIndex = Get-HttpsIdentityBytes -RelativePath ".uai/index.uai" -MaximumBytes ([int64]$publicIndexIdentity.bytes)
    Assert-ExpectedIdentityBytes -Bytes $httpsPublicIndex -Identity $publicIndexIdentity
    if (-not [Linq.Enumerable]::SequenceEqual([byte[]]$httpsPublicIndex, [byte[]]$ftpsPublicIndex)) {
        throw "HTTPS and FTPS public UAI index bytes do not identify the same site."
    }
    Assert-PrivateNamespaceReadback -RequestPath "/.uai/source-retirement.lock/preflight.bin"
    Assert-RetiredTargetIdentities
}

function Assert-ExactHeader {
    param([Net.Http.HttpResponseMessage]$Response, [string]$Name, [string]$Expected)

    $values = @()
    if ($Response.Headers.Contains($Name)) { $values += @($Response.Headers.GetValues($Name)) }
    if ($Response.Content.Headers.Contains($Name)) { $values += @($Response.Content.Headers.GetValues($Name)) }
    if ($values.Count -ne 1 -or [string]$values[0] -cne $Expected) {
        throw "Retired-route response header is not exact: $Name"
    }
}

function Assert-GoneResponse {
    param([Net.Http.HttpResponseMessage]$Response, [bool]$ExpectBody)

    if ([int]$Response.StatusCode -ne 410) { throw "Retired route did not return 410 Gone." }
    Assert-NoLocation -Response $Response
    Assert-ExactHeader -Response $Response -Name "Cache-Control" -Expected "no-store"
    Assert-ExactHeader -Response $Response -Name "X-Robots-Tag" -Expected "noindex, nofollow"
    Assert-ExactHeader -Response $Response -Name "X-Content-Type-Options" -Expected "nosniff"
    Assert-ExactHeader -Response $Response -Name "Content-Type" -Expected "text/plain; charset=utf-8"
    if ($Response.Content.Headers.ContentLength -ne 54) { throw "Retired-route Content-Length is not 54." }
    $body = Read-BoundedHttpBody -Response $Response -MaximumBytes 128
    if ($ExpectBody) {
        if (-not [Linq.Enumerable]::SequenceEqual([byte[]]$body, [byte[]]$goneBodyBytes)) {
            throw "Retired-route response body is not exact."
        }
    }
    elseif ($body.Length -ne 0) { throw "Retired-route HEAD response included a body." }
}

function Assert-PreMutationRouteObservation {
    if ($script:fixtureMode) { return }
    foreach ($variant in $retiredVariants) {
        foreach ($cacheBusted in @($false, $true)) {
            $url = "$origin$variant"
            if ($cacheBusted) { $url += "?source_retirement=$Nonce" }
            $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Head, $url)
            $response = $script:httpClient.SendAsync($request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
            try {
                Assert-NoLocation -Response $response
                $status = [int]$response.StatusCode
                if ($status -notin @(200, 403, 404, 410)) { throw "Pre-mutation route capability returned an unsafe status." }
                if ($status -eq 410) { Assert-GoneResponse -Response $response -ExpectBody $false }
            }
            finally { $response.Dispose(); $request.Dispose() }
        }
    }
}

function Assert-FixtureGoneContract {
    foreach ($relative in $artifactPaths) {
        $expected = Get-LocalArtifactBytes -RelativePath $relative
        if (-not (Test-TargetIdentity -RelativePath $relative -Bytes $expected)) {
            throw "Fixture guard identity is incomplete."
        }
    }
    $expectedPaths = @($retiredPaths | ForEach-Object { "/$_".ToLowerInvariant() })
    foreach ($variant in $retiredVariants) {
        $decoded = [Uri]::UnescapeDataString(($variant -split "\?", 2)[0]).ToLowerInvariant()
        if ($expectedPaths -cnotcontains $decoded) {
            throw "Fixture route decoder did not resolve an exact retired route."
        }
    }
    $script:readbackRequestCount += $retiredVariants.Count * 4
}

function Assert-RetiredRouteReadbacks {
    if ($script:fixtureMode) { Assert-FixtureGoneContract; return }
    foreach ($methodName in @("HEAD", "GET")) {
        foreach ($variant in $retiredVariants) {
            foreach ($cacheBusted in @($false, $true)) {
                $url = "$origin$variant"
                if ($cacheBusted) { $url += "?source_retirement=$Nonce" }
                $method = if ($methodName -ceq "HEAD") { [Net.Http.HttpMethod]::Head } else { [Net.Http.HttpMethod]::Get }
                $request = [Net.Http.HttpRequestMessage]::new($method, $url)
                $response = $script:httpClient.SendAsync($request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
                try { Assert-GoneResponse -Response $response -ExpectBody ($methodName -ceq "GET") }
                finally { $response.Dispose(); $request.Dispose() }
                $script:readbackRequestCount += 1
            }
        }
    }
}

function Invoke-CapabilityRehearsal {
    $script:phase = "capability-rehearsal"
    Assert-ExactLockOwnership
    $sourceDirectory = "$lockPath/cap-source"
    $targetDirectory = "$lockPath/cap-target"
    New-TargetDirectoryCreateOnly -RelativePath $sourceDirectory
    New-TargetDirectoryCreateOnly -RelativePath $targetDirectory
    $oldBytes = [Text.Encoding]::ASCII.GetBytes("old`n")
    $newBytes = [Text.Encoding]::ASCII.GetBytes("new`n")
    $sourceProbe = "$sourceDirectory/probe.bin"
    $targetProbe = "$targetDirectory/probe.bin"
    Send-TargetFileCreateOnly -RelativePath $targetProbe -Bytes $oldBytes
    Send-TargetFileCreateOnly -RelativePath $sourceProbe -Bytes $newBytes
    Assert-PrivateNamespaceReadback -RequestPath "/$sourceProbe"
    if ($FixtureFault -ceq "capability-rename") { throw "Injected capability rename failure." }
    Move-TargetFileReplacing -SourcePath $sourceProbe -TargetPath $targetProbe
    if (-not (Test-TargetIdentity -RelativePath $targetProbe -Bytes $newBytes)) {
        throw "Cross-directory atomic replacement capability is unavailable."
    }
    Remove-TargetFile -RelativePath $targetProbe
    Remove-TargetDirectory -RelativePath $sourceDirectory
    Remove-TargetDirectory -RelativePath $targetDirectory
    Assert-ExactLockOwnership
}

function Install-ControlArtifact {
    param([int]$Index, [string]$RelativePath, [byte[]]$Bytes)

    $script:phase = "install-guard-$Index"
    Assert-ExactLockOwnership
    $existing = Get-TargetBytes -RelativePath $RelativePath -MaximumBytes $maximumControlBytes
    if ($null -ne $existing -and
        $existing.Length -eq $Bytes.Length -and
        (Get-Sha256Bytes -Bytes $existing) -ceq (Get-Sha256Bytes -Bytes $Bytes)) {
        $script:installationRecords += [pscustomobject]@{
            path = $RelativePath
            status = "already-current"
            had_previous = $true
            previous_bytes = $existing
            backup_path = $null
            stage_path = $null
        }
        $script:artifactsInstalled += 1
        return
    }
    $backupPath = $null
    if ($null -ne $existing) {
        $backupPath = "$lockPath/backup-$Index.bin"
        Send-TargetFileCreateOnly -RelativePath $backupPath -Bytes $existing
    }
    $stagePath = "$lockPath/stage-$Index.bin"
    Send-TargetFileCreateOnly -RelativePath $stagePath -Bytes $Bytes
    $record = [pscustomobject]@{
        path = $RelativePath
        status = "pending"
        had_previous = $null -ne $existing
        previous_bytes = $existing
        backup_path = $backupPath
        stage_path = $stagePath
    }
    $script:installationRecords += $record
    Move-TargetFileReplacing -SourcePath $stagePath -TargetPath $RelativePath
    if (-not (Test-TargetIdentity -RelativePath $RelativePath -Bytes $Bytes)) {
        throw "Installed Apache retirement artifact identity is invalid."
    }
    $record.status = "installed"
    $script:artifactsInstalled += 1
    Assert-ExactLockOwnership
}

function Restore-UnprovenControlArtifacts {
    $script:phase = "guard-rollback-before-proof"
    Assert-ExactLockOwnership
    for ($index = $script:installationRecords.Count - 1; $index -ge 0; $index--) {
        Assert-ExactLockOwnership
        $record = $script:installationRecords[$index]
        if ($record.status -ceq "already-current") { continue }
        if ([bool]$record.had_previous) {
            if ((Get-TargetSize -RelativePath ([string]$record.backup_path)) -ge 0) {
                Move-TargetFileReplacing -SourcePath ([string]$record.backup_path) -TargetPath ([string]$record.path)
            }
            if (-not (Test-TargetIdentity -RelativePath ([string]$record.path) -Bytes ([byte[]]$record.previous_bytes))) {
                throw "Pre-proof guard rollback did not restore the prior control bytes."
            }
        }
        else { Remove-TargetFile -RelativePath ([string]$record.path) }
        if ($null -ne $record.stage_path) { Remove-TargetFile -RelativePath ([string]$record.stage_path) }
        $record.status = "rolled-back-before-proof"
    }
    $script:artifactsInstalled = @($script:installationRecords | Where-Object { $_.status -ceq "already-current" }).Count
}

function Remove-PrivateControls {
    Assert-ExactLockOwnership
    $cleanupFailed = $false
    foreach ($index in 0..($artifactPaths.Count - 1)) {
        foreach ($relative in @("$lockPath/stage-$index.bin", "$lockPath/backup-$index.bin")) {
            Assert-ExactLockOwnership
            try { Remove-TargetFile -RelativePath $relative } catch { $cleanupFailed = $true }
        }
    }
    foreach ($relative in @(
        "$lockPath/cap-source/probe.bin",
        "$lockPath/cap-target/probe.bin"
    )) {
        Assert-ExactLockOwnership
        try { Remove-TargetFile -RelativePath $relative } catch { $cleanupFailed = $true }
    }
    foreach ($relative in @("$lockPath/cap-source", "$lockPath/cap-target")) {
        Assert-ExactLockOwnership
        try { Remove-TargetDirectory -RelativePath $relative } catch { $cleanupFailed = $true }
    }
    if ($cleanupFailed) {
        $script:lockDisposition = "owned-cleanup-incomplete"
        throw "Private retirement-control cleanup is incomplete."
    }
    Assert-ExactLockOwnership
    Remove-TargetFile -RelativePath $lockOwnerPath
    if ((Get-TargetSize -RelativePath $lockOwnerPath) -ge 0) {
        $script:lockDisposition = "owned-marker-removal-unproven"
        throw "Remote retirement lock owner-marker removal is unproven."
    }
    $script:lockOwnerMarkerRemoved = $true
    try { Remove-TargetDirectory -RelativePath $lockPath } catch { $cleanupFailed = $true }
    $lockPresent = $true
    $observationFailed = $false
    try { $lockPresent = Test-TargetDirectory -RelativePath $lockPath } catch { $observationFailed = $true }
    if ($lockPresent -or $observationFailed) {
        $script:lockDisposition = "cleanup-unproven"
        throw "Private retirement-control cleanup is unproven."
    }
    $script:lockAcquired = $false
    $script:lockOwnershipProven = $false
    $script:lockDisposition = "absent-after-owned-cleanup"
}

function Get-CredentialProfile {
    param([Parameter(Mandatory)][string]$Path)

    $resolved = [IO.Path]::GetFullPath($Path)
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) { throw "External FTPS profile is unavailable." }
    $item = Get-Item -LiteralPath $resolved
    if ($item.Length -lt 1 -or $item.Length -gt 1048576) { throw "External FTPS profile size is invalid." }
    $settings = [Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [Xml.XmlReader]::Create($resolved, $settings)
    $document = [Xml.XmlDocument]::new()
    $document.XmlResolver = $null
    try { $document.Load($reader) } finally { $reader.Dispose() }
    $matches = @($document.SelectNodes("/FileZilla3/Servers/Server") | Where-Object {
        $node = $_.SelectSingleNode("Name")
        $node -and [string]::Equals([string]$node.InnerText, $profileName, [StringComparison]::Ordinal)
    })
    if ($matches.Count -ne 1) { throw "External FTPS profile identity is not exact." }
    $site = $matches[0]
    $requiredNode = {
        param([string]$Name)
        $nodes = @($site.SelectNodes($Name))
        if ($nodes.Count -ne 1) { throw "External FTPS profile shape is incomplete." }
        return $nodes[0]
    }
    $hostNode = & $requiredNode "Host"
    $portNode = & $requiredNode "Port"
    $protocolNode = & $requiredNode "Protocol"
    $userNode = & $requiredNode "User"
    $passwordNode = & $requiredNode "Pass"
    $logonTypeNode = & $requiredNode "Logontype"
    $remoteDirNode = & $requiredNode "RemoteDir"
    if (-not $hostNode -or -not $portNode -or -not $protocolNode -or -not $userNode -or
        -not $passwordNode -or -not $logonTypeNode -or -not $remoteDirNode) {
        throw "External FTPS profile shape is incomplete."
    }
    $hostName = ([string]$hostNode.InnerText).Trim().ToLowerInvariant()
    $userName = ([string]$userNode.InnerText).Trim()
    $protocol = ([string]$protocolNode.InnerText).Trim()
    $logonType = ([string]$logonTypeNode.InnerText).Trim()
    $remoteRoot = ConvertFrom-FileZillaRemoteDir -Value ([string]$remoteDirNode.InnerText)
    $port = 0
    $encoding = if ($passwordNode.Attributes["encoding"]) { [string]$passwordNode.Attributes["encoding"].Value } else { "" }
    if ($encoding -and -not [string]::Equals($encoding, "base64", [StringComparison]::OrdinalIgnoreCase)) {
        throw "External FTPS password encoding is unsupported."
    }
    $password = if ($encoding) {
        [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$passwordNode.InnerText))
    }
    else { [string]$passwordNode.InnerText }
    if ([Uri]::CheckHostName($hostName) -eq [UriHostNameType]::Unknown -or
        -not [int]::TryParse(([string]$portNode.InnerText).Trim(), [ref]$port) -or
        $port -lt 1 -or $port -gt 65535 -or
        $protocol -cne "0" -or $logonType -cne "1" -or
        [string]::IsNullOrWhiteSpace($userName) -or $userName.Length -gt 256 -or
        [string]::IsNullOrEmpty($password) -or $password.Length -gt 4096) {
        $password = $null
        throw "External FTPS profile contains an invalid bounded field."
    }
    return [pscustomobject]@{
        Host = $hostName
        Port = $port
        Protocol = $protocol
        LogonType = $logonType
        User = $userName
        Password = $password
        RemoteRoot = $remoteRoot
    }
}

function Get-TransportTupleSha256 {
    param([Parameter(Mandatory)][object]$Profile)

    $material = (@(
        "tinyrustlm.mirust.ftps_transport_tuple.v1",
        "profile=$profileName",
        "protocol=$($Profile.Protocol)",
        "logon_type=$($Profile.LogonType)",
        "tls=explicit-required",
        "host=$($Profile.Host)",
        "port=$($Profile.Port)",
        "remote_dir=$($Profile.RemoteRoot)"
    ) -join "`n") + "`n"
    return Get-Sha256Bytes -Bytes ([Text.Encoding]::UTF8.GetBytes($material))
}

function Assert-TransportAuthorityBinding {
    param([Parameter(Mandatory)][object]$Profile)

    $tupleSha256 = Get-TransportTupleSha256 -Profile $Profile
    if ($tupleSha256 -cne [string]$script:transportAuthority.tuple_sha256) {
        throw "Selected FTPS protocol, logon, host, port, or decoded RemoteDir does not match the immutable transport authority."
    }
    $script:transportTupleSha256 = $tupleSha256
}

function Invoke-GitScalar {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $output = @(& git -C $repositoryRoot @Arguments)
    if ($LASTEXITCODE -ne 0 -or $output.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$output[0])) {
        throw "Git identity command failed."
    }
    return ([string]$output[0]).Trim()
}

function Assert-PublishGitIdentity {
    param([Parameter(Mandatory)][object[]]$Artifacts)

    $status = @(& git -C $repositoryRoot status --porcelain --untracked-files=all)
    if ($LASTEXITCODE -ne 0 -or $status.Count -ne 0) { throw "Source retirement requires a clean Git checkout." }
    $head = Invoke-GitScalar -Arguments @("rev-parse", "HEAD")
    $tree = Invoke-GitScalar -Arguments @("rev-parse", "HEAD^{tree}")
    $commitPaths = @($Artifacts | ForEach-Object { [string]$_.path }) + @($transportAuthorityRelativePath)
    foreach ($relativePath in $commitPaths) {
        $commitBlob = Invoke-GitScalar -Arguments @("rev-parse", "${head}:$relativePath")
        $localPath = Join-Path $repositoryRoot ($relativePath -replace "/", "\")
        $localBlob = Invoke-GitScalar -Arguments @("hash-object", "--no-filters", "--", $localPath)
        if ($commitBlob -cne $localBlob) { throw "Retirement artifact bytes do not equal the source commit." }
    }
    foreach ($retired in $repositoryRetiredPaths) {
        & git -C $repositoryRoot cat-file -e "${head}:$retired" 2>$null
        if ($LASTEXITCODE -eq 0) { throw "Source commit still contains a retired source copy." }
    }
    $branch = Invoke-GitScalar -Arguments @("symbolic-ref", "--quiet", "--short", "HEAD")
    $upstream = Invoke-GitScalar -Arguments @("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
    $slash = $upstream.IndexOf("/")
    if ($slash -lt 1 -or $slash -eq $upstream.Length - 1) { throw "Git upstream identity is not an exact remote branch." }
    $remote = $upstream.Substring(0, $slash)
    $remoteBranch = $upstream.Substring($slash + 1)
    if ($remote -notmatch "^[A-Za-z0-9._-]+$" -or $remote.StartsWith("-") -or
        $remoteBranch -notmatch "^[A-Za-z0-9._/-]+$" -or
        $remoteBranch.Contains("..") -or $remoteBranch.StartsWith("-") -or
        $remoteBranch.StartsWith("/") -or $remoteBranch.EndsWith("/")) {
        throw "Git upstream contains an unsafe remote or branch name."
    }
    $remoteRef = "refs/heads/$remoteBranch"
    $remoteIdentity = @(& git -C $repositoryRoot ls-remote --exit-code $remote $remoteRef)
    if ($LASTEXITCODE -ne 0 -or $remoteIdentity.Count -ne 1) { throw "Read-only remote Git equality query failed." }
    $match = [regex]::Match([string]$remoteIdentity[0], "^([0-9a-f]{40})\s+$([regex]::Escape($remoteRef))$")
    if (-not $match.Success -or $match.Groups[1].Value -cne $head) {
        throw "Publishing checkout does not exactly equal its read-only remote branch identity."
    }
    $attribute = @(& git -C $repositoryRoot check-attr binary -- `
        "deploy/source-retirement-receipts/__future__.json" `
        $transportAuthorityRelativePath)
    if ($LASTEXITCODE -ne 0 -or
        $attribute -cnotcontains "deploy/source-retirement-receipts/__future__.json: binary: set" -or
        $attribute -cnotcontains "${transportAuthorityRelativePath}: binary: set") {
        throw "Source-retirement evidence and transport-authority byte-preservation attributes are not effective."
    }
    return [ordered]@{ source_commit = $head; source_tree = $tree; branch = $branch; upstream = $upstream }
}

function Resolve-ReceiptPath {
    if ([string]::IsNullOrWhiteSpace($ReceiptPath)) { throw "An explicit create-only receipt path is required." }
    $resolved = [IO.Path]::GetFullPath($ReceiptPath)
    if (Test-Path -LiteralPath $resolved) { throw "Source-retirement receipt path is already occupied." }
    $receiptRoot = if ($script:fixtureMode) {
        [IO.Path]::GetFullPath((Join-Path $fixtureOwner "receipts"))
    }
    else {
        [IO.Path]::GetFullPath((Join-Path $repositoryRoot "deploy\source-retirement-receipts"))
    }
    if ($script:fixtureMode) {
        $expectedFixtureReceipt = [IO.Path]::GetFullPath((Join-Path $receiptRoot "receipt.json"))
        if (-not [string]::Equals($resolved, $expectedFixtureReceipt, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Fixture receipt path is not the exact owned evidence path."
        }
    }
    else {
        $expectedLeaf = "source-retirement-[0-9]{8}T[0-9]{6}Z-$Nonce\.json"
        if (-not [string]::Equals((Split-Path -Parent $resolved), $receiptRoot, [StringComparison]::OrdinalIgnoreCase) -or
            (Split-Path -Leaf $resolved) -notmatch "^$expectedLeaf$") {
            throw "Production source-retirement receipt path is not canonical."
        }
    }
    $parent = Split-Path -Parent $resolved
    $parentOwner = Split-Path -Parent $parent
    $ownerItem = Get-Item -LiteralPath $parentOwner -Force
    if (-not $ownerItem.PSIsContainer -or ($ownerItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Receipt evidence owner must be a plain directory."
    }
    if (Test-Path -LiteralPath $parent) {
        $parentItem = Get-Item -LiteralPath $parent -Force
        if (-not $parentItem.PSIsContainer -or ($parentItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Receipt parent must be a plain directory."
        }
    }
    if (-not $resolved.EndsWith(".json", [StringComparison]::Ordinal)) {
        throw "Source-retirement receipt must have a canonical JSON leaf."
    }
    $base = $resolved.Substring(0, $resolved.Length - 5)
    $script:journalStartedPath = "$base.started.json"
    $script:journalTerminalPath = "$base.terminal.json"
    if ((Test-Path -LiteralPath $script:journalStartedPath) -or
        (Test-Path -LiteralPath $script:journalTerminalPath)) {
        throw "Source-retirement durable journal identity is occupied."
    }
    $script:evidenceRoot = $parent
    return $resolved
}

function Initialize-EvidenceRoot {
    param([Parameter(Mandatory)][string]$ResolvedReceiptPath)

    $script:phase = "evidence-root-reservation"
    if (-not (Test-Path -LiteralPath $script:evidenceRoot)) {
        [IO.Directory]::CreateDirectory($script:evidenceRoot) | Out-Null
        $script:evidenceRootCreated = $true
    }
    $item = Get-Item -LiteralPath $script:evidenceRoot -Force
    if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Source-retirement evidence root is not a plain directory."
    }
    if ((Test-Path -LiteralPath $ResolvedReceiptPath) -or
        (Test-Path -LiteralPath $script:journalStartedPath) -or
        (Test-Path -LiteralPath $script:journalTerminalPath)) {
        throw "Source-retirement evidence identity became occupied before reservation."
    }
}

function ConvertTo-BoundedJsonBytes {
    param([System.Collections.IDictionary]$Value, [Parameter(Mandatory)][string]$Description)

    $json = ($Value | ConvertTo-Json -Depth 7) + "`n"
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json)
    if ($bytes.Length -lt 1 -or $bytes.Length -gt $maximumReceiptBytes) {
        throw "$Description exceeds its byte bound."
    }
    return ,$bytes
}

function Write-DurableJsonCreateOnly {
    param(
        [System.Collections.IDictionary]$Value,
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Description
    )

    $bytes = ConvertTo-BoundedJsonBytes -Value $Value -Description $Description
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}

function Initialize-LockOwnershipIdentity {
    if ($null -ne $script:lockOwnerBytes -or $null -ne $script:lockOwnerToken) {
        throw "Remote retirement lock ownership identity was already initialized."
    }
    $tokenBytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($tokenBytes) } finally { $random.Dispose() }
    $script:lockOwnerToken = ([BitConverter]::ToString($tokenBytes)).Replace("-", "").ToLowerInvariant()
    $owner = [ordered]@{
        schema = "tinyrustlm.mirust.source_retirement_lock_owner.v1"
        site = "TinyRustLM.MiRust.com"
        origin = $origin
        operation_nonce = $Nonce
        owner_token = $script:lockOwnerToken
        deployment_receipt_sha256 = [string]$script:deploymentAuthority.receipt_sha256
        transport_authority_sha256 = [string]$script:transportAuthority.sha256
        transport_binding_sha256 = $script:transportBindingSha256
    }
    $script:lockOwnerBytes = ConvertTo-BoundedJsonBytes -Value $owner -Description "Remote retirement lock owner marker"
    $script:lockOwnerSha256 = Get-Sha256Bytes -Bytes $script:lockOwnerBytes
}

function Reserve-DurableLocalJournal {
    param([Parameter(Mandatory)][string]$StartedUtc)

    $script:phase = "local-journal-reservation"
    $record = [ordered]@{
        schema = "tinyrustlm.mirust.source_retirement_journal.v1"
        state = "started"
        site = "TinyRustLM.MiRust.com"
        origin = $origin
        operation_nonce = $Nonce
        mode = if ($script:fixtureMode) { "fixture" } else { "ftps" }
        deployment_receipt_sha256 = [string]$script:deploymentAuthority.receipt_sha256
        transport_authority_sha256 = [string]$script:transportAuthority.sha256
        transport_binding_sha256 = $script:transportBindingSha256
        lock_owner_token = $script:lockOwnerToken
        lock_owner_sha256 = $script:lockOwnerSha256
        started_utc = $StartedUtc
    }
    Write-DurableJsonCreateOnly -Value $record -Path $script:journalStartedPath -Description "Source-retirement journal start"
    $script:journalReserved = $true
}

function Write-TerminalJournal {
    param([System.Collections.IDictionary]$Receipt)

    if (-not $script:journalReserved -or $script:terminalEvidenceWritten) { return }
    $record = [ordered]@{
        schema = "tinyrustlm.mirust.source_retirement_journal.v1"
        state = "terminal"
        site = "TinyRustLM.MiRust.com"
        origin = $origin
        operation_nonce = $Nonce
        mode = if ($script:fixtureMode) { "fixture" } else { "ftps" }
        deployment_receipt_sha256 = [string]$script:deploymentAuthority.receipt_sha256
        transport_authority_sha256 = [string]$script:transportAuthority.sha256
        transport_binding_sha256 = $script:transportBindingSha256
        lock_owner_sha256 = $script:lockOwnerSha256
        started_utc = [string]$Receipt.started_utc
        completed_utc = [string]$Receipt.completed_utc
        status = [string]$Receipt.status
        failure_phase = $Receipt.failure_phase
        failure_code = $Receipt.failure_code
        lock_disposition = $script:lockDisposition
        retired_files = $Receipt.retired_files
    }
    Write-DurableJsonCreateOnly -Value $record -Path $script:journalTerminalPath -Description "Source-retirement terminal journal"
    $script:terminalEvidenceWritten = $true
}

function Write-CreateOnlyReceipt {
    param([System.Collections.IDictionary]$Receipt, [Parameter(Mandatory)][string]$ResolvedPath)

    if ($FixtureFault -ceq "receipt-write") { throw "Injected final receipt failure." }
    $bytes = ConvertTo-BoundedJsonBytes -Value $Receipt -Description "Source-retirement receipt"
    $temporary = "$ResolvedPath.$Nonce.tmp"
    if ((Test-Path -LiteralPath $ResolvedPath) -or (Test-Path -LiteralPath $temporary)) {
        throw "Source-retirement receipt or temporary path is occupied."
    }
    $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    [IO.File]::Move($temporary, $ResolvedPath)
}

function New-ReceiptRecord {
    param([string]$Status, [object]$GitIdentity, [object[]]$Artifacts, [string]$StartedUtc, [string]$FailureCode)

    $record = [ordered]@{
        schema = "tinyrustlm.mirust.source_retirement_receipt.v1"
        site = "TinyRustLM.MiRust.com"
        origin = $origin
        operation_nonce = $Nonce
        mode = if ($script:fixtureMode) { "fixture" } else { "ftps" }
        source_commit = if ($null -ne $GitIdentity) { [string]$GitIdentity.source_commit } else { $null }
        source_tree = if ($null -ne $GitIdentity) { [string]$GitIdentity.source_tree } else { $null }
        deployment_receipt_sha256 = if ($null -ne $script:deploymentAuthority) { [string]$script:deploymentAuthority.receipt_sha256 } else { $null }
        transport_authority_sha256 = if ($null -ne $script:transportAuthority) { [string]$script:transportAuthority.sha256 } else { $null }
        transport_binding_sha256 = $script:transportBindingSha256
        lock_owner_sha256 = $script:lockOwnerSha256
        started_utc = $StartedUtc
        completed_utc = (Get-Date).ToUniversalTime().ToString("o")
        status = $Status
        public_artifact_count = $Artifacts.Count
        public_artifacts = $Artifacts
        retired_files = $script:retiredResults
        installed_artifact_count = $script:artifactsInstalled
        readback_request_count = $script:readbackRequestCount
        lock_disposition = $script:lockDisposition
        failure_phase = if ([string]::IsNullOrEmpty($FailureCode)) { $null } else { $script:phase }
        failure_code = if ([string]::IsNullOrEmpty($FailureCode)) { $null } else { $FailureCode }
    }
    return $record
}

if ($Publish -and $script:fixtureMode) { throw "Publish and fixture modes are mutually exclusive." }
if (-not $script:fixtureMode -and $FixtureFault -cne "none") { throw "Failure injection is fixture-only." }

$artifacts = @(Assert-LocalArtifacts)
if (-not $Publish -and -not $script:fixtureMode) {
    $script:transportAuthority = Get-TransportAuthority
    Write-Host ("PREPARED {0} exact public artifacts; {1} exact retirements; no credentials or network used." -f $artifacts.Count, $retiredPaths.Count)
    exit 0
}
if ([string]::IsNullOrWhiteSpace($Nonce)) { throw "Execution requires an explicit 12-character lowercase hexadecimal nonce." }

$gitIdentity = $null
if ($script:fixtureMode) {
    $script:fixtureTargetRoot = [IO.Path]::GetFullPath($FixtureRoot)
    $fixtureOwner = [IO.Path]::GetFullPath((Split-Path -Parent $script:fixtureTargetRoot))
    $script:fixtureAuthorityRoot = [IO.Path]::GetFullPath((Join-Path $fixtureOwner "authority"))
    $script:fixtureHttpsRoot = [IO.Path]::GetFullPath((Join-Path $fixtureOwner "https"))
    Assert-PlainFixtureTree
}
$script:transportAuthority = Get-TransportAuthority
if (-not $script:fixtureMode) { $gitIdentity = Assert-PublishGitIdentity -Artifacts $artifacts }
$resolvedReceiptPath = Resolve-ReceiptPath
$startedUtc = (Get-Date).ToUniversalTime().ToString("o")
$profile = $null
$handler = $null
$failureCode = $null

try {
    $script:deploymentAuthority = Get-DeploymentAuthority
    $profile = Get-CredentialProfile -Path $FileZillaProfilePath
    Assert-TransportAuthorityBinding -Profile $profile
    $script:ftpHost = $profile.Host
    $script:ftpPort = $profile.Port
    $script:ftpProtocol = $profile.Protocol
    $script:ftpUser = $profile.User
    $script:ftpRemoteRoot = $profile.RemoteRoot
    if (-not $script:fixtureMode) {
        $script:credential = [Net.NetworkCredential]::new($profile.User, $profile.Password)
    }
    $profile.Password = $null
    $script:transportBindingSha256 = Get-TransportBindingSha256

    if (-not $script:fixtureMode) {
        $handler = [Net.Http.HttpClientHandler]::new()
        $handler.AllowAutoRedirect = $false
        $script:httpClient = [Net.Http.HttpClient]::new($handler)
        $script:httpClient.Timeout = [TimeSpan]::FromSeconds(30)
        Assert-PreMutationRouteObservation
    }
    Assert-RemoteSiteIdentity
    if (-not (Test-TargetDirectory -RelativePath ".uai")) { throw "Private remote control namespace is absent." }
    if (Test-TargetDirectory -RelativePath $lockPath) { throw "Private remote retirement lock is already occupied." }
    if ($FixtureFault -ceq "before-evidence") { throw "Injected failure after read-only preflight." }

    Initialize-EvidenceRoot -ResolvedReceiptPath $resolvedReceiptPath
    Initialize-LockOwnershipIdentity
    Reserve-DurableLocalJournal -StartedUtc $startedUtc
    $script:phase = "lock-acquisition"
    $script:lockAttempted = $true
    $script:lockDisposition = "creation-attempted-unproven"
    try {
        New-TargetDirectoryCreateOnly -RelativePath $lockPath
    }
    catch {
        $script:lockAcquired = $false
        $script:lockOwnershipProven = $false
        $script:lockDisposition = "creation-result-ambiguous-unowned"
        throw
    }
    $script:phase = "lock-ownership-proof"
    $script:lockDisposition = "directory-created-ownership-unproven"
    Send-TargetFileCreateOnly -RelativePath $lockOwnerPath -Bytes $script:lockOwnerBytes -RetainOnAmbiguity
    Assert-ExactLockOwnership
    $script:lockAcquired = $true
    $script:lockOwnershipProven = $true
    $script:lockDisposition = "present-owned-exact"
    if ($FixtureFault -ceq "lock-owner-substitution") {
        [IO.File]::WriteAllBytes(
            (Resolve-FixturePath -RelativePath $lockOwnerPath),
            [Text.Encoding]::ASCII.GetBytes("foreign-owner-marker`n")
        )
        Assert-ExactLockOwnership
    }
    Invoke-CapabilityRehearsal

    for ($index = 0; $index -lt $artifactPaths.Count; $index++) {
        $relative = $artifactPaths[$index]
        Install-ControlArtifact -Index $index -RelativePath $relative -Bytes (Get-LocalArtifactBytes -RelativePath $relative)
    }

    $script:phase = "guard-readback-before-removal"
    if ($FixtureFault -ceq "guard-readback") { throw "Injected guard readback failure." }
    Assert-RetiredRouteReadbacks
    $script:guardReadbackProven = $true
    $script:phase = "target-identity-before-removal"
    Assert-RetiredTargetIdentities
    if ($FixtureFault -ceq "before-removal") { throw "Injected failure before guarded removal." }

    Assert-ExactLockOwnership
    $script:deletionStarted = $true
    for ($index = 0; $index -lt $retiredPaths.Count; $index++) {
        Assert-ExactLockOwnership
        $script:phase = "remove-retired-$index"
        $relative = $retiredPaths[$index]
        $wasPresent = (Get-TargetSize -RelativePath $relative) -ge 0
        Remove-TargetFile -RelativePath $relative
        if ((Get-TargetSize -RelativePath $relative) -ge 0) { throw "Retired source copy remains present." }
        $script:retiredResults += [ordered]@{
            path = $relative
            status = if ($wasPresent) { "deleted" } else { "already-absent" }
        }
        if ($FixtureFault -ceq "after-first-removal" -and $index -eq 0) {
            throw "Injected failure after first monotonic removal."
        }
    }

    $script:phase = "terminal-readback"
    Assert-ExactLockOwnership
    Assert-RetiredRouteReadbacks
    foreach ($relative in $retiredPaths) {
        if ((Get-TargetSize -RelativePath $relative) -ge 0) { throw "Retired source copy reappeared after removal." }
    }
    $script:phase = "private-control-cleanup"
    if ($FixtureFault -ceq "cleanup") { throw "Injected cleanup failure." }
    Remove-PrivateControls

    $receipt = New-ReceiptRecord -Status "retired-routes-verified" -GitIdentity $gitIdentity -Artifacts $artifacts -StartedUtc $startedUtc -FailureCode ""
    Write-TerminalJournal -Receipt $receipt
    Write-CreateOnlyReceipt -Receipt $receipt -ResolvedPath $resolvedReceiptPath
    Write-Host "RETIRED routes verified; receipt created."
}
catch {
    if (-not $script:journalReserved) {
        if ($script:evidenceRootCreated) {
            try { [IO.Directory]::Delete($script:evidenceRoot, $false) } catch { }
        }
        throw
    }
    if ($script:terminalEvidenceWritten) { throw }
    $failureCode = $_.Exception.GetType().FullName
    $failedPhase = $script:phase
    $rollbackFailed = $false
    $ownershipLost = $false
    if ($script:lockOwnershipProven) {
        try { Assert-ExactLockOwnership }
        catch { $ownershipLost = $true }
    }
    if ($script:lockOwnershipProven -and -not $script:deletionStarted -and -not $script:guardReadbackProven) {
        if ($script:installationRecords.Count -gt 0) {
            try { Restore-UnprovenControlArtifacts } catch { $rollbackFailed = $true }
        }
        if (-not $rollbackFailed) {
            try { Remove-PrivateControls } catch { $rollbackFailed = $true }
        }
    }
    if (($script:guardReadbackProven -or $script:deletionStarted) -and $script:lockAcquired) {
        $script:lockDisposition = "retained-for-reconciliation"
    }
    $status = if ($failedPhase -ceq "deployment-identity" -or
        $failedPhase -ceq "remote-site-identity" -or
        $failedPhase -ceq "local-journal-reservation") {
        "identity-rejected"
    }
    elseif ($failedPhase -ceq "lock-acquisition" -or $failedPhase -ceq "lock-ownership-proof") {
        "lock-ownership-unproven"
    }
    elseif ($failedPhase -ceq "capability-rehearsal") {
        "capability-rejected"
    }
    elseif ($script:deletionStarted) {
        "guarded-removal-incomplete"
    }
    elseif ($script:artifactsInstalled -eq $artifactPaths.Count) {
        "guarded-removal-not-started"
    }
    else { "guard-install-incomplete" }
    if ($failedPhase -ceq "private-control-cleanup" -and $script:retiredResults.Count -eq $retiredPaths.Count) {
        $status = "retired-routes-verified-control-cleanup-pending"
    }
    if ($rollbackFailed -or $ownershipLost) { $status = "ambiguous-control-state" }
    else { $script:phase = $failedPhase }
    $receipt = New-ReceiptRecord -Status $status -GitIdentity $gitIdentity -Artifacts $artifacts -StartedUtc $startedUtc -FailureCode $failureCode
    Write-TerminalJournal -Receipt $receipt
    Write-CreateOnlyReceipt -Receipt $receipt -ResolvedPath $resolvedReceiptPath
    throw
}
finally {
    if ($null -ne $profile) { $profile.Password = $null }
    $script:credential = $null
    $script:ftpUser = $null
    if ($null -ne $script:httpClient) { $script:httpClient.Dispose(); $script:httpClient = $null }
    if ($null -ne $handler) { $handler.Dispose() }
}
