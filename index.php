<?php
if (PHP_SAPI === 'cli-server') {
    $requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $candidate = __DIR__ . $requestPath;
    if ($requestPath !== '/' && is_file($candidate)) {
        return false;
    }
}
$site = require __DIR__ . '/data/site.php';
$pages = require __DIR__ . '/data/pages.php';
require __DIR__ . '/includes/functions.php';
$route = current_route($pages);
if ($route === '/404/') {
    http_response_code(404);
    $page = [
        'title' => 'Page not found - TinyRustLM',
        'summary' => 'The requested TinyRustLM page was not found.',
        'badge' => '404',
        'sections' => [[
            'heading' => 'No route matched',
            'body' => 'Use the primary navigation or machine-readable index files to locate the TinyRustLM content surface.',
            'points' => ['Start at /', 'Review /llms.txt', 'Review /sitemap.xml'],
        ]],
    ];
} else {
    $page = $pages[$route];
}
if (wants_markdown()) { serve_markdown($site, $route, $page); }
require __DIR__ . '/includes/header.php';
?>
<section class="hero">
    <div class="shell hero-grid">
        <div class="hero-copy">
            <p class="eyebrow"><?= e($page['badge']) ?></p>
            <h1><?= e($page['title']) ?></h1>
            <p class="lede"><?= e($page['summary']) ?></p>
            <div class="hero-actions" aria-label="Primary actions">
                <?php if (!empty($page['actions'])): ?>
                    <?php foreach ($page['actions'] as $action_index => $action): ?>
                        <?php $href = $action['href'] ?? $action['path'] ?? '#'; ?>
                        <a class="button<?= $action_index === 0 ? ' primary' : '' ?>" href="<?= e($href) ?>"<?= external_link_attrs($href) ?>><?= e($action['label'] ?? 'Open') ?></a>
                    <?php endforeach; ?>
                <?php else: ?>
                    <a class="button primary" href="/architecture/">Explore architecture</a>
                    <a class="button" href="<?= e($route . '?format=md') ?>">Markdown view</a>
                <?php endif; ?>
            </div>
        </div>
        <aside class="runtime-card" aria-label="Runtime constraints">
            <h2>Runtime envelope</h2>
            <dl>
                <div><dt>Model budget</dt><dd>33,554,432 bytes</dd></div>
                <div><dt>Execution</dt><dd>Browser-local WASM</dd></div>
                <div><dt>Formats</dt><dd>f32 · q8_0 · q4_0</dd></div>
                <div><dt>Dependencies</dt><dd>Zero third-party runtime stack</dd></div>
            </dl>
        </aside>
    </div>
</section>
<?php if (!empty($page['cards'])): ?>
<section class="band">
    <div class="shell card-grid">
        <?php foreach ($page['cards'] as $card): ?>
        <article class="info-card">
            <h2><?= e($card['title']) ?></h2>
            <p><?= e($card['text']) ?></p>
            <?php if (!empty($card['href'])): ?>
                <p class="card-link"><a href="<?= e($card['href']) ?>"<?= external_link_attrs($card['href']) ?>><?= e($card['link_label'] ?? 'Open') ?></a></p>
            <?php endif; ?>
        </article>
        <?php endforeach; ?>
    </div>
</section>
<?php endif; ?>
<section class="content shell">
    <?php foreach ($page['sections'] as $index => $section): ?>
        <article class="content-section" id="section-<?= (int)$index + 1 ?>">
            <p class="section-index">0<?= (int)$index + 1 ?></p>
            <div>
                <h2><?= e($section['heading']) ?></h2>
                <p><?= e($section['body']) ?></p>
                <?php if (!empty($section['points'])): ?>
                    <ul class="check-list">
                    <?php foreach ($section['points'] as $point): ?>
                        <li><?= e($point) ?></li>
                    <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
                <?php if (!empty($section['links'])): ?>
                    <div class="section-links">
                        <?php foreach ($section['links'] as $link): ?>
                            <?php $href = $link['href'] ?? $link['path'] ?? '#'; ?>
                            <a class="button" href="<?= e($href) ?>"<?= external_link_attrs($href) ?>><?= e($link['label'] ?? 'Open') ?></a>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </article>
    <?php endforeach; ?>
</section>
<section class="shell proof-panel">
    <h2>Plain PHP deployment notes</h2>
    <div class="proof-grid">
        <p>No WordPress bootstrap, theme system, database requirement, composer package, npm build, CDN script, Bootstrap class dependency, or jQuery dependency.</p>
        <p>Routes are handled by <code>index.php</code> and server rewrites. Core content lives in <code>data/pages.php</code>. HTML and Markdown share the same page data.</p>
        <p>Upload the package to the subdomain root, point Apache/Nginx to the folder, and keep <code>.htaccess</code> enabled for clean routes on Apache.</p>
    </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
