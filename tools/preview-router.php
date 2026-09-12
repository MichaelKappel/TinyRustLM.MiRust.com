<?php
/** Emit a fixed preview error without reflecting request paths or local data. */
function preview_error(int $status): never
{
    $body = $status === 404 ? "Not found.\n" : "Request rejected.\n";
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    header('Content-Length: ' . strlen($body));
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') { echo $body; }
    exit;
}

/** Keep the local read-only preview behind an exact loopback Host boundary. */
function validate_preview_request(): void
{
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    $port = $_SERVER['SERVER_PORT'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (!in_array($host, ['127.0.0.1:' . $port, 'localhost:' . $port], true)) {
        preview_error(421);
    }
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET', 'HEAD'], true)) {
        header('Allow: GET, HEAD');
        preview_error(405);
    }
}

/** Resolve an exact file through direct ancestors inside the canonical root. */
function preview_direct_file(string $root, string $relative): ?string
{
    $current = realpath($root);
    if ($current === false || $current !== rtrim($root, '/\\') || is_link($root)) { return null; }
    foreach (explode('/', $relative) as $segment) {
        if ($segment === '' || $segment === '.' || $segment === '..') { return null; }
        $current .= DIRECTORY_SEPARATOR . $segment;
        $resolved = realpath($current);
        if ($resolved === false || is_link($current) || $resolved !== $current) { return null; }
    }
    return is_file($current) ? $current : null;
}

/** Serve only manifest-declared static readbacks; leave clean page routes to PHP. */
function serve_preview_static_request(string $root): void
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $path = explode('?', $uri, 2)[0];
    if (strlen($uri) > 2048 || !preg_match('~^/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]*$~D', $path) ||
        preg_match('~(?:^|/)\.{1,2}(?:/|$)~', $path)) {
        preview_error(404);
    }
    // This existing reviewed manifest grants paths only, never a publication claim.
    $manifestFile = preview_direct_file($root, 'deploy/site-deployment-manifest.v1.json');
    if ($manifestFile === null || filesize($manifestFile) > 2 * 1024 * 1024) { preview_error(503); }
    try {
        $manifest = json_decode(file_get_contents($manifestFile), true, 32, JSON_THROW_ON_ERROR);
    } catch (Throwable $error) { preview_error(503); }
    if (($manifest['schema'] ?? null) !== 'tinyrustlm.mirust.site_deployment_manifest.v1' ||
        !is_array($manifest['files'] ?? null) || count($manifest['files']) > 256) { preview_error(503); }
    $mimeTypes = [
        'css' => 'text/css; charset=utf-8',
        'js' => 'text/javascript; charset=utf-8',
        'md' => 'text/markdown; charset=utf-8',
        'txt' => 'text/plain; charset=utf-8',
        'uai' => 'text/plain; charset=utf-8',
        'xml' => 'application/xml; charset=utf-8',
    ];
    foreach ($manifest['files'] as $entry) {
        if (!is_array($entry)) { preview_error(503); }
        $relative = $entry['path'] ?? null;
        if (!is_string($relative) || '/' . $relative !== $path ||
            ($entry['https_readback_path'] ?? null) !== $path) { continue; }
        $mime = $mimeTypes[pathinfo($relative, PATHINFO_EXTENSION)] ?? null;
        $file = preview_direct_file($root, $relative);
        if ($mime === null || $file === null) { preview_error(404); }
        if (filesize($file) > 2 * 1024 * 1024) { preview_error(503); }
        $bytes = file_get_contents($file);
        if ($bytes === false) { preview_error(503); }
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . strlen($bytes));
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') { echo $bytes; }
        exit;
    }
    // Never delegate arbitrary files or directories to the built-in file server.
    if (str_contains($path, '.') || str_starts_with($path, '/data/') ||
        str_starts_with($path, '/includes/') || str_starts_with($path, '/tools/') ||
        str_starts_with($path, '/deploy/') || str_starts_with($path, '/artifacts/')) {
        preview_error(404);
    }
}
