# Run the canonical transaction with transport and durable writes simulated only in memory.
. (Join-Path $PSScriptRoot 'retire-public-source-copies.ps1') -Publish -Nonce '0123456789ab' -FileZillaProfilePath 'NOT-READ'

Describe 'Canonical retirement authorities' {
    It 'reads the exact retained deployment and current controls from the owning repository' {
        Initialize-SourceRetirementState
        @(Assert-LocalArtifacts).Count | Should Be 8
        $authority = Get-DeploymentAuthority
        $authority.version | Should Be '1.8.2'
        $authority.files.Count | Should Be 18
        $authority.receipt_sha256 | Should Be $canonicalDeploymentReceiptSha256
        { Get-TransportAuthority } | Should Throw 'blocked pending an independently attested'
    }

    It 'rejects unsafe remote paths and validates decoded FileZilla segment lengths' {
        foreach ($value in @('../escape','/absolute','a\b','a//b','a/./b','a/../b','a:stream')) {
            { Assert-RelativePath -Path $value } | Should Throw
        }
        ConvertFrom-FileZillaRemoteDir -Value '1 0 11 public_html 10 tinyrustlm' | Should Be 'public_html/tinyrustlm'
        { ConvertFrom-FileZillaRemoteDir -Value '1 0 10 public_html' } | Should Throw
        { ConvertFrom-FileZillaRemoteDir -Value '1 0 2 ..' } | Should Throw
    }

    It 'rejects changed publication identity and corrupted receipt bytes in memory' {
        $script:authorityFault='manifest'
        Mock Get-ContainedPlainFileBytes {
            param($Root,$RelativePath,$MaximumBytes)
            if ($Root -ne $repositoryRoot) { throw 'noncanonical authority root' }
            $bytes=[IO.File]::ReadAllBytes((Join-Path $Root ($RelativePath -replace '/', '\')))
            if ($script:authorityFault -eq 'manifest' -and $RelativePath -eq 'deploy/site-deployment-manifest.v1.json') {
                $value=[Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
                $value.last_verified_publication.source_commit='0'*40
                return ,([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 30)))
            }
            if ($script:authorityFault -eq 'receipt' -and $RelativePath -eq $canonicalDeploymentReceiptPath) { $bytes[0] = $bytes[0] -bxor 1 }
            return ,$bytes
        }
        { Get-DeploymentAuthority } | Should Throw 'deployment identity drifted'
        $script:authorityFault='receipt'
        { Get-DeploymentAuthority } | Should Throw 'receipt bytes drifted'
    }

    It 'does not admit a self-modified transport attestation' {
        Mock Get-ContainedPlainFileBytes {
            param($Root,$RelativePath,$MaximumBytes)
            $value=[IO.File]::ReadAllText((Join-Path $repositoryRoot $transportAuthorityRelativePath)) | ConvertFrom-Json
            $value.status='active-bound';$value.tuple_sha256='0'*64
            return ,([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 5)))
        }
        { Get-TransportAuthority } | Should Throw 'authority bytes drifted'
    }

    It 'rejects same-length identity corruption and transport tuple drift' {
        $bytes = [Text.Encoding]::UTF8.GetBytes('abc')
        $identity = [pscustomobject]@{bytes=3;sha256=(Get-Sha256Bytes -Bytes $bytes)}
        Assert-ExpectedIdentityBytes -Bytes $bytes -Identity $identity
        { Assert-ExpectedIdentityBytes -Bytes ([Text.Encoding]::UTF8.GetBytes('abd')) -Identity $identity } | Should Throw
        $profile = [pscustomobject]@{Host='fixture.invalid';Port=21;Protocol='0';LogonType='1';RemoteRoot='public_html/portal'}
        $script:transportAuthority = [pscustomobject]@{tuple_sha256=(Get-TransportTupleSha256 -Profile $profile)}
        Assert-TransportAuthorityBinding -Profile $profile
        foreach ($field in @('Host','Port','Protocol','LogonType','RemoteRoot')) {
            $changed = $profile.PSObject.Copy()
            $changed.$field = 'different'
            { Assert-TransportAuthorityBinding -Profile $changed } | Should Throw
        }
    }

    It 'writes create-only durable JSON without overwriting earlier evidence' {
        $target = Join-Path $TestDrive 'journal.json'
        Write-DurableJsonCreateOnly -Value @{value='first'} -Path $target -Description 'test journal'
        $before = Get-IdentityFileSha256 -Path $target
        { Write-DurableJsonCreateOnly -Value @{value='second'} -Path $target -Description 'test journal' } | Should Throw
        Get-IdentityFileSha256 -Path $target | Should Be $before
        { ConvertTo-BoundedJsonBytes -Value @{value=('x'*20000)} -Description 'too large' } | Should Throw
    }

    It 'promotes one final receipt and rejects reuse without a second temporary copy' {
        $target = Join-Path $TestDrive 'receipt.json'
        Write-CreateOnlyReceipt -Receipt @{status='test-only'} -ResolvedPath $target
        Test-Path -LiteralPath "$target.$Nonce.tmp" | Should Be $false
        { Write-CreateOnlyReceipt -Receipt @{status='second'} -ResolvedPath $target } | Should Throw
        ([IO.File]::ReadAllText($target) | ConvertFrom-Json).status | Should Be 'test-only'
    }

    It 'bounds response bodies and rejects redirect headers' {
        $response = [Net.Http.HttpResponseMessage]::new([Net.HttpStatusCode]::OK)
        $response.Content = [Net.Http.ByteArrayContent]::new([byte[]]@(1,2,3))
        try { { Read-BoundedHttpBody -Response $response -MaximumBytes 2 } | Should Throw }
        finally { $response.Dispose() }
        $response = [Net.Http.HttpResponseMessage]::new([Net.HttpStatusCode]::OK)
        $response.Content = [Net.Http.ByteArrayContent]::new([byte[]]@(1,2,3))
        try {
            (Read-BoundedHttpBody -Response $response -MaximumBytes 3).Length | Should Be 3
            Assert-NoLocation -Response $response
            $response.Headers.Location = [Uri]::new('https://fixture.invalid/')
            { Assert-NoLocation -Response $response } | Should Throw
        }
        finally { $response.Dispose() }
    }
}

Describe 'Retirement transaction with in-memory transport' {
    BeforeEach {
        $script:failure = ''
        $script:remoteFiles = @{}
        $script:remoteDirectories = @{'.uai'=$true}
        $script:durable = @{}
        $script:events = [Collections.Generic.List[string]]::new()
        $script:profileStub = [pscustomobject]@{Host='fixture.invalid';Port=21;Protocol='0';LogonType='1';User='test';Password='PRIVATE-TEST-VALUE';RemoteRoot='public_html/portal'}
        $script:identities = @{}
        foreach ($relative in $identityPaths) {
            $bytes = [Text.Encoding]::UTF8.GetBytes("synthetic $relative")
            $script:remoteFiles[$relative] = $bytes
            $script:identities[$relative] = [pscustomobject]@{bytes=$bytes.Length;sha256=(Get-Sha256Bytes -Bytes $bytes)}
        }
        $script:remoteFiles['docs/unrelated.txt'] = [Text.Encoding]::UTF8.GetBytes('unrelated')

        Mock Assert-CanonicalSourceAuthority {
            if ((Test-Path Env:NODE_OPTIONS) -or (Test-Path Env:NODE_PATH)) { throw 'Node injection reached source preflight' }
            $script:events.Add('source')
            if ($script:failure -eq 'source') { throw 'source rejected' }
        }
        Mock Assert-PublishGitIdentity {
            if ((Test-Path Env:NODE_OPTIONS) -or (Test-Path Env:NODE_PATH)) { throw 'Node injection reached Git validation' }
            $script:events.Add('git')
            [pscustomobject]@{source_commit=('1'*40);source_tree=('2'*40)}
        }
        Mock Get-TransportAuthority { [pscustomobject]@{sha256=('3'*64);tuple_sha256=(Get-TransportTupleSha256 -Profile $script:profileStub)} }
        Mock Get-DeploymentAuthority {
            $script:phase='deployment-identity'
            if ($script:failure -eq 'deployment') { throw 'deployment identity drift' }
            [pscustomobject]@{receipt_sha256=('4'*64);files=$script:identities}
        }
        Mock Get-CredentialProfile { $script:profileStub.PSObject.Copy() }
        Mock Resolve-ReceiptPath {
            if ($script:durable.Count) { throw 'evidence identity occupied' }
            $script:journalStartedPath='started';$script:journalTerminalPath='terminal';'receipt'
        }
        Mock Initialize-EvidenceRoot { $script:events.Add('evidence') }
        Mock Write-DurableJsonCreateOnly {
            param($Value,$Path,$Description)
            if ($script:durable.ContainsKey($Path)) { throw 'durable identity occupied' }
            if ($script:failure -eq 'journal' -and $Path -eq 'started') { throw 'journal write failed' }
            $script:durable[$Path] = $Value | ConvertTo-Json -Depth 20 | ConvertFrom-Json
            $script:events.Add($Path)
        }
        Mock Write-CreateOnlyReceipt {
            param($Receipt,$ResolvedPath)
            if ($script:failure -eq 'receipt') { throw 'receipt write failed' }
            $script:durable[$ResolvedPath] = $Receipt | ConvertTo-Json -Depth 20 | ConvertFrom-Json
        }
        Mock New-FtpRequest { throw 'Unmocked network boundary' }
        Mock Assert-PreMutationRouteObservation { $script:events.Add('routes-before') }
        Mock Assert-PrivateNamespaceReadback {
            $script:events.Add('private-readback')
            if ($script:failure -eq 'owner-after-proof' -and $script:phase -eq 'capability-rehearsal') {
                $script:remoteFiles[$lockOwnerPath] = [Text.Encoding]::UTF8.GetBytes('substituted-after-proof')
            }
        }
        Mock Get-HttpsIdentityBytes {
            param($RelativePath,$MaximumBytes)
            if ($script:failure -eq 'https' -and $RelativePath -eq '.uai/index.uai') { return ,([Text.Encoding]::UTF8.GetBytes('wrong')) }
            return ,$script:remoteFiles[$RelativePath]
        }
        Mock Get-TargetSize {
            param($RelativePath)
            if ($script:remoteFiles.ContainsKey($RelativePath)) { return [int64]$script:remoteFiles[$RelativePath].Length }
            return [int64]-1
        }
        Mock Get-TargetBytes {
            param($RelativePath,$MaximumBytes)
            if (-not $script:remoteFiles.ContainsKey($RelativePath)) { return $null }
            if ($script:remoteFiles[$RelativePath].Length -gt $MaximumBytes) { throw 'read bound exceeded' }
            return ,$script:remoteFiles[$RelativePath]
        }
        Mock Test-TargetDirectory { param($RelativePath) return $script:remoteDirectories.ContainsKey($RelativePath) }
        Mock New-TargetDirectoryCreateOnly {
            param($RelativePath)
            if ($script:remoteDirectories.ContainsKey($RelativePath)) { throw 'directory occupied' }
            $script:remoteDirectories[$RelativePath]=$true
            if ($RelativePath -eq $lockPath) {
                if (-not $script:durable.ContainsKey('started')) { throw 'mutation before journal' }
                $script:events.Add('lock')
                if ($script:failure -eq 'ambiguous-lock') { throw 'creation outcome ambiguous' }
            }
        }
        Mock Remove-TargetDirectory {
            param($RelativePath)
            foreach ($name in $script:remoteFiles.Keys) { if ($name.StartsWith("$RelativePath/")) { throw 'directory not empty' } }
            $script:remoteDirectories.Remove($RelativePath)
        }
        Mock Send-TargetFileCreateOnly {
            param($RelativePath,$Bytes,$RetainOnAmbiguity)
            if ($script:remoteFiles.ContainsKey($RelativePath)) { throw 'file occupied' }
            $script:remoteFiles[$RelativePath] = [byte[]]$Bytes.Clone()
            if ($RelativePath -eq $lockOwnerPath -and $script:failure -eq 'foreign-owner') {
                $script:remoteFiles[$RelativePath] = [Text.Encoding]::UTF8.GetBytes('foreign')
            }
        }
        Mock Move-TargetFileReplacing {
            param($SourcePath,$TargetPath)
            if ($script:failure -eq 'rename' -and $SourcePath.EndsWith('cap-source/probe.bin')) { throw 'atomic rename unavailable' }
            $script:remoteFiles[$TargetPath] = $script:remoteFiles[$SourcePath]
            $script:remoteFiles.Remove($SourcePath)
        }
        Mock Remove-TargetFile {
            param($RelativePath)
            if ($script:failure -eq 'cleanup' -and $script:phase -eq 'private-control-cleanup') { throw 'cleanup failed' }
            if ($script:failure -eq 'second-delete' -and $RelativePath -eq $retiredPaths[1]) { throw 'removal interrupted' }
            $script:remoteFiles.Remove($RelativePath)
        }
        Mock Assert-RetiredRouteReadbacks {
            if ($script:failure -eq 'guard') { throw 'guard readback failed' }
            foreach ($relative in $artifactPaths) {
                if (-not (Test-TargetIdentity -RelativePath $relative -Bytes (Get-LocalArtifactBytes -RelativePath $relative))) { throw 'guard incomplete' }
            }
            if ($script:failure -eq 'target-after-guard') { $script:remoteFiles[$retiredPaths[0]] = [Text.Encoding]::UTF8.GetBytes('drift') }
            $script:events.Add('guard-readback')
        }
    }

    It 'runs all phases in order and removes only the exact target set' {
        Invoke-SourceRetirement
        $script:durable.receipt.status | Should Be 'retired-routes-verified'
        $script:durable.terminal.status | Should Be 'retired-routes-verified'
        $script:durable.receipt.retired_files.Count | Should Be $retiredPaths.Count
        foreach ($relative in $retiredPaths) { $script:remoteFiles.ContainsKey($relative) | Should Be $false }
        $script:remoteFiles.ContainsKey('docs/unrelated.txt') | Should Be $true
        $script:remoteDirectories.ContainsKey($lockPath) | Should Be $false
        ($script:events.IndexOf('started') -lt $script:events.IndexOf('lock')) | Should Be $true
        $script:credential | Should BeNullOrEmpty
        ($script:durable.receipt | ConvertTo-Json -Depth 20) | Should Not Match 'PRIVATE-TEST-VALUE|fixture.invalid|public_html'
    }

    It 'rejects source, deployment and HTTPS identity failures before writes' {
        foreach ($fault in @('source','deployment','https')) {
            $script:failure=$fault
            { Invoke-SourceRetirement } | Should Throw
            $script:durable.Count | Should Be 0
            $script:remoteDirectories.ContainsKey($lockPath) | Should Be $false
        }
    }

    It 'reserves durable evidence before lock mutation' {
        $script:failure='journal'
        { Invoke-SourceRetirement } | Should Throw
        $script:durable.Count | Should Be 0
        $script:remoteDirectories.ContainsKey($lockPath) | Should Be $false
    }

    It 'does not delete an ambiguous lock or a substituted owner marker' {
        $script:failure='ambiguous-lock'
        { Invoke-SourceRetirement } | Should Throw
        $script:durable.receipt.status | Should Be 'lock-ownership-unproven'
        $script:remoteDirectories.ContainsKey($lockPath) | Should Be $true
        $script:remoteFiles.ContainsKey($retiredPaths[0]) | Should Be $true
    }

    It 'keeps a substituted owner marker and never starts deletion' {
        $script:failure='foreign-owner'
        { Invoke-SourceRetirement } | Should Throw
        [Text.Encoding]::UTF8.GetString($script:remoteFiles[$lockOwnerPath]) | Should Be 'foreign'
        $script:durable.receipt.status | Should Be 'lock-ownership-unproven'
        $script:remoteFiles.ContainsKey($retiredPaths[0]) | Should Be $true
    }

    It 'leaves a preexisting foreign lock untouched and writes no receipt' {
        $script:remoteDirectories[$lockPath]=$true
        $script:remoteFiles[$lockOwnerPath]=[Text.Encoding]::UTF8.GetBytes('foreign')
        { Invoke-SourceRetirement } | Should Throw
        $script:durable.Count | Should Be 0
        [Text.Encoding]::UTF8.GetString($script:remoteFiles[$lockOwnerPath]) | Should Be 'foreign'
    }

    It 'revokes already-proven ownership after later marker substitution' {
        $script:failure='owner-after-proof'
        { Invoke-SourceRetirement } | Should Throw
        $script:lockOwnershipProven | Should Be $false
        $script:remoteDirectories.ContainsKey($lockPath) | Should Be $true
        [Text.Encoding]::UTF8.GetString($script:remoteFiles[$lockOwnerPath]) | Should Be 'substituted-after-proof'
        $script:remoteFiles.ContainsKey($retiredPaths[0]) | Should Be $true
    }

    It 'rolls back controls when rename capability fails before guard proof' {
        $script:failure='rename'
        { Invoke-SourceRetirement } | Should Throw
        $script:durable.receipt.status | Should Be 'capability-rejected'
        $script:remoteDirectories.ContainsKey($lockPath) | Should Be $false
        $script:remoteFiles.ContainsKey($retiredPaths[0]) | Should Be $true
    }

    It 'restores old controls and removes newly introduced controls on failed guard proof' {
        $before=[byte[]]$script:remoteFiles['.uai/.htaccess'].Clone()
        $script:failure='guard'
        { Invoke-SourceRetirement } | Should Throw
        (Get-Sha256Bytes -Bytes $script:remoteFiles['.uai/.htaccess']) | Should Be (Get-Sha256Bytes -Bytes $before)
        $script:remoteFiles.ContainsKey('.htaccess') | Should Be $false
        $script:remoteFiles.ContainsKey($retiredPaths[0]) | Should Be $true
        $script:remoteDirectories.ContainsKey($lockPath) | Should Be $false
    }

    It 'keeps proven guards when target identity changes before deletion' {
        $script:failure='target-after-guard'
        { Invoke-SourceRetirement } | Should Throw
        $script:durable.receipt.status | Should Be 'guarded-removal-not-started'
        $script:remoteDirectories.ContainsKey($lockPath) | Should Be $true
        $script:deletionStarted | Should Be $false
    }

    It 'does not restore the first deleted source after a later deletion fails' {
        $script:failure='second-delete'
        { Invoke-SourceRetirement } | Should Throw
        $script:durable.receipt.status | Should Be 'guarded-removal-incomplete'
        $script:remoteFiles.ContainsKey($retiredPaths[0]) | Should Be $false
        $script:remoteFiles.ContainsKey($retiredPaths[1]) | Should Be $true
        $script:durable.receipt.retired_files.Count | Should Be 1
    }

    It 'reports incomplete control cleanup separately from completed removal' {
        $script:failure='cleanup'
        { Invoke-SourceRetirement } | Should Throw
        $script:durable.receipt.status | Should Be 'retired-routes-verified-control-cleanup-pending'
        $script:durable.receipt.retired_files.Count | Should Be $retiredPaths.Count
        $script:remoteDirectories.ContainsKey($lockPath) | Should Be $true
    }

    It 'retains terminal evidence when the final receipt write fails' {
        $script:failure='receipt'
        { Invoke-SourceRetirement } | Should Throw
        $script:durable.terminal.status | Should Be 'retired-routes-verified'
        $script:durable.ContainsKey('receipt') | Should Be $false
        $script:terminalEvidenceWritten | Should Be $true
    }

    It 'rejects an occupied receipt identity before a second transaction mutates anything' {
        Invoke-SourceRetirement
        $lockEvents=@($script:events | Where-Object { $_ -eq 'lock' }).Count
        { Invoke-SourceRetirement } | Should Throw 'occupied'
        @($script:events | Where-Object { $_ -eq 'lock' }).Count | Should Be $lockEvents
    }

    It 'disables Node startup injection for the whole transaction and restores it on failure' {
        $env:NODE_OPTIONS='--require definitely-not-loaded'
        $env:NODE_PATH='definitely-not-searched'
        try {
            Invoke-SourceRetirement
            $env:NODE_OPTIONS | Should Be '--require definitely-not-loaded'
            $env:NODE_PATH | Should Be 'definitely-not-searched'
            $script:failure='source'
            { Invoke-SourceRetirement } | Should Throw
            $env:NODE_OPTIONS | Should Be '--require definitely-not-loaded'
            $env:NODE_PATH | Should Be 'definitely-not-searched'
        }
        finally { Remove-Item Env:NODE_OPTIONS,Env:NODE_PATH -ErrorAction SilentlyContinue }
    }
}
