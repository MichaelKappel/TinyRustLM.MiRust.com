<?php
/** Returns a safe HTML-escaped string. */
function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

/** Decodes one bounded URI-path layer without canonicalizing unrelated paths. */
function safely_decoded_request_path(string $request_uri): ?string
{
    if ($request_uri === '' || strlen($request_uri) > 2048 || $request_uri[0] !== '/') { return null; }
    $path = parse_url($request_uri, PHP_URL_PATH);
    if (!is_string($path) || $path === '' || strlen($path) > 2048) { return null; }
    if (preg_match('/%(?![0-9A-Fa-f]{2})/', $path) === 1) { return null; }

    $decoded = rawurldecode($path);
    if (
        $decoded === '' ||
        strlen($decoded) > 2048 ||
        $decoded[0] !== '/' ||
        str_contains($decoded, '\\') ||
        preg_match('/[\x00-\x1F\x7F]/', $decoded) === 1 ||
        preg_match('//u', $decoded) !== 1
    ) {
        return null;
    }
    return $decoded;
}

/** Matches retired source copies, local UAI records, and the non-public raw archive. */
function retired_public_source_path(string $request_uri): ?string
{
    $decoded = safely_decoded_request_path($request_uri);
    if ($decoded === null) { return null; }

    $retired = [
        '/docs/reports/analyzing-website-virality.md',
        '/docs/reports/future-proof-native-html5-techniques.md',
        '/docs/reports/gguf-mirust-all-source-review-bundle.txt',
        '/docs/reports/innovative-vanilla-web-design.md',
        '/docs/reports/mememtech-vanilla-web-architecture.md',
        '/docs/reports/memory-systems-domains-research.md',
        '/docs/reports/rust-wasm-neural-model-patterns.md',
        '/docs/reports/tiny-language-models-for-rust-wasm.md',
        '/docs/reports/tiny-language-models-for-wasm.md',
        '/docs/reports/understanding-tinyrustlm-creation-and-purpose.md',
        '/docs/reports/vanilla-js-future-proof-techniques.md',
    ];
    foreach ($retired as $path) {
        if (strcasecmp($decoded, $path) === 0) { return $path; }
    }
    $lower = strtolower($decoded);
    if (
        str_starts_with($lower, '/.uai/') &&
        $lower !== '/.uai/index.uai' &&
        $lower !== '/.uai/long-term-memory.uai'
    ) {
        return '/.uai/non-public';
    }
    if (
        str_starts_with($lower, '/docs/runtime-portal/') &&
        $lower !== '/docs/runtime-portal/index.md'
    ) {
        return '/docs/runtime-portal/non-public';
    }
    return null;
}

/** Emits the fixed terminal response for a retired public source copy. */
function serve_retired_public_source_copy_if_requested(string $request_uri): void
{
    if (retired_public_source_path($request_uri) === null) { return; }

    $body = "This public source copy has been permanently retired.\n";
    http_response_code(410);
    header_remove('Location');
    header('Content-Type: text/plain; charset=utf-8', true);
    header('Content-Length: ' . strlen($body), true);
    header('Cache-Control: no-store', true);
    header('X-Robots-Tag: noindex, nofollow', true);
    header('X-Content-Type-Options: nosniff', true);
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') { echo $body; }
    exit;
}

/** Normalizes the request URI into a canonical route key. */
function current_route(array $pages): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = '/' . trim($path, '/');
    if ($path !== '/') { $path .= '/'; }
    if (isset($pages[$path])) { return $path; }
    return '/404/';
}

/** Determines whether the client requested Markdown output. */
function wants_markdown(): bool
{
    if (isset($_GET['format']) && strtolower((string)$_GET['format']) === 'md') { return true; }
    $accept = strtolower($_SERVER['HTTP_ACCEPT'] ?? '');
    return str_contains($accept, 'text/markdown') && !str_contains($accept, 'text/markdown;q=0');
}

/** Converts one call-to-action/link item to Markdown. */
function link_markdown(array $link): string
{
    $label = $link['label'] ?? 'Link';
    $href = $link['href'] ?? $link['path'] ?? '#';
    $description = isset($link['description']) && $link['description'] !== '' ? ': ' . $link['description'] : '';
    return '- [' . $label . '](' . $href . ')' . $description;
}

/** Converts page data into compact Markdown for agent readers. */
function page_markdown(array $site, string $route, array $page): string
{
    $lines = [];
    $lines[] = '# ' . $page['title'];
    $lines[] = '';
    $lines[] = '> ' . $page['summary'];
    $lines[] = '';
    $lines[] = '- Site: ' . $site['name'];
    $lines[] = '- Canonical: ' . rtrim($site['domain'], '/') . $route;
    $lines[] = '- Prepared version: ' . $site['version'];
    $lines[] = '- Prepared status: ' . $site['release_status'];
    $lines[] = '- Last verified publication: ' . $site['last_verified_version'] . ' (' . $site['last_publish_date'] . ')';
    $lines[] = '- Updated UTC: ' . $site['updated_utc'];
    $lines[] = '';
    if (!empty($page['actions'])) {
        $lines[] = '## Primary actions';
        $lines[] = '';
        foreach ($page['actions'] as $action) { $lines[] = link_markdown($action); }
        $lines[] = '';
    }
    foreach ($page['sections'] as $section) {
        $lines[] = '## ' . $section['heading'];
        $lines[] = '';
        $lines[] = $section['body'];
        $lines[] = '';
        foreach ($section['points'] ?? [] as $point) { $lines[] = '- ' . $point; }
        if (!empty($section['points'])) { $lines[] = ''; }
        if (!empty($section['links'])) {
            foreach ($section['links'] as $link) { $lines[] = link_markdown($link); }
            $lines[] = '';
        }
    }
    if (!empty($page['cards'])) {
        $lines[] = '## Key surfaces';
        $lines[] = '';
        foreach ($page['cards'] as $card) {
            $lines[] = '### ' . $card['title'];
            $lines[] = $card['text'];
            if (!empty($card['href'])) { $lines[] = '[' . ($card['link_label'] ?? 'Open') . '](' . $card['href'] . ')'; }
            $lines[] = '';
        }
    }
    return implode("\n", $lines);
}

/** Emits a Markdown response and terminates the PHP request. */
function serve_markdown(array $site, string $route, array $page): void
{
    header('Content-Type: text/markdown; charset=utf-8');
    header('Vary: Accept');
    echo page_markdown($site, $route, $page);
    exit;
}

/** Produces a short active-class string for navigation. */
function nav_class(string $route, string $path): string
{
    return $route === $path ? ' aria-current="page" class="active"' : '';
}

/** Returns true when a link path is the active route. */
function is_active_path(string $route, ?string $path): bool
{
    return $path !== null && $route === $path;
}

/** Returns true when any item in a navigation group targets the active route. */
function nav_group_active(string $route, array $group): bool
{
    foreach ($group['items'] ?? [] as $item) {
        if (is_active_path($route, $item['path'] ?? null)) { return true; }
    }
    return false;
}

/** Normalizes internal and external navigation items into an href. */
function nav_href(array $item): string
{
    return $item['href'] ?? $item['path'] ?? '#';
}

/** Marks external links for safe new-tab behavior. */
function external_link_attrs(string $href): string
{
    if (str_starts_with($href, 'http://') || str_starts_with($href, 'https://')) {
        return ' target="_blank" rel="noopener noreferrer"';
    }
    return '';
}

/** Returns a CSS class for a grouped top-menu disclosure. */
function nav_group_class(string $route, array $group): string
{
    $classes = ['nav-group'];
    if (nav_group_active($route, $group)) { $classes[] = 'active'; }
    return implode(' ', $classes);
}
