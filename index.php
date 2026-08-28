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
        'actions' => [
            ['label' => 'Return to overview', 'href' => '/'],
            ['label' => 'Open docs index', 'href' => '/docs/'],
        ],
        'sections' => [[
            'heading' => 'No route matched',
            'body' => 'Use the primary navigation or machine-readable index files to locate the TinyRustLM content surface.',
            'points' => ['Start at the project overview', 'Review llms.txt', 'Review sitemap.xml'],
        ]],
    ];
} else {
    $page = $pages[$route];
}
if (wants_markdown()) {
    serve_markdown($site, $route, $page);
}
require __DIR__ . '/includes/header.php';
?>
<section class="page-intro" aria-labelledby="page-title">
    <div class="shell">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
            <a href="/">TinyRustLM</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page"><?= e($page['badge']) ?></span>
        </nav>
        <div class="intro-grid">
            <div class="intro-copy">
                <p class="eyebrow"><?= e($page['badge']) ?></p>
                <h1 id="page-title"><?= e($page['title']) ?></h1>
                <p class="lede"><?= e($page['summary']) ?></p>
            </div>
            <div class="intro-actions" aria-label="Page actions">
                <?php if (!empty($page['actions'])): ?>
                    <?php foreach ($page['actions'] as $action_index => $action): ?>
                        <?php $href = $action['href'] ?? $action['path'] ?? '#'; ?>
                        <a class="button<?= $action_index === 0 ? ' primary' : '' ?>" href="<?= e($href) ?>"<?= external_link_attrs($href) ?>><?= e($action['label'] ?? 'Open') ?></a>
                    <?php endforeach; ?>
                <?php else: ?>
                    <a class="button primary" href="<?= e($site['public_app']) ?>" target="_blank" rel="noopener noreferrer">Open TinyRustLM</a>
                    <a class="button" href="<?= e($route . '?format=md') ?>">Markdown</a>
                <?php endif; ?>
            </div>
        </div>
        <dl class="portal-facts" aria-label="TinyRustLM system facts">
            <div><dt>Execution</dt><dd>Browser-local Rust/WASM</dd></div>
            <div><dt>Model contract</dt><dd>Verified six-member SLM2 compositions</dd></div>
            <div><dt>Network boundary</dt><dd>No remote inference</dd></div>
            <div><dt>Evidence</dt><dd>Checksums, receipts, and tests</dd></div>
        </dl>
    </div>
</section>

<?php if (!empty($page['cards'])): ?>
<section class="surface-band" aria-label="Key project surfaces">
    <div class="shell card-grid">
        <?php foreach ($page['cards'] as $card): ?>
        <article class="info-card">
            <h2><?= e($card['title']) ?></h2>
            <p><?= e($card['text']) ?></p>
            <?php if (!empty($card['href'])): ?>
                <p class="card-link"><a href="<?= e($card['href']) ?>"<?= external_link_attrs($card['href']) ?>><?= e($card['link_label'] ?? 'Open') ?> <span aria-hidden="true">&rarr;</span></a></p>
            <?php endif; ?>
        </article>
        <?php endforeach; ?>
    </div>
</section>
<?php endif; ?>

<div class="content-layout shell">
    <aside class="page-rail" aria-label="Page navigation">
        <nav>
            <strong>On this page</strong>
            <?php foreach ($page['sections'] as $index => $section): ?>
                <a href="#section-<?= (int) $index + 1 ?>"><span><?= e(str_pad((string) ((int) $index + 1), 2, '0', STR_PAD_LEFT)) ?></span><?= e($section['heading']) ?></a>
            <?php endforeach; ?>
        </nav>
        <div class="rail-resources">
            <strong>Page resources</strong>
            <a href="<?= e($route . '?format=md') ?>">Markdown version</a>
            <a href="/docs/">Docs and memory</a>
            <a href="/llms.txt">Agent index</a>
        </div>
    </aside>

    <section class="article-content" aria-label="<?= e($page['title']) ?> sections">
        <?php foreach ($page['sections'] as $index => $section): ?>
            <article class="content-section" id="section-<?= (int) $index + 1 ?>">
                <header>
                    <p class="section-index"><?= e(str_pad((string) ((int) $index + 1), 2, '0', STR_PAD_LEFT)) ?></p>
                    <h2><?= e($section['heading']) ?></h2>
                </header>
                <p class="section-body"><?= e($section['body']) ?></p>
                <?php if (!empty($section['points'])): ?>
                    <ul class="point-list">
                    <?php foreach ($section['points'] as $point): ?>
                        <li><?= e($point) ?></li>
                    <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
                <?php if (!empty($section['links'])): ?>
                    <div class="section-links">
                        <?php foreach ($section['links'] as $link): ?>
                            <?php $href = $link['href'] ?? $link['path'] ?? '#'; ?>
                            <a href="<?= e($href) ?>"<?= external_link_attrs($href) ?>><?= e($link['label'] ?? 'Open') ?> <span aria-hidden="true">&rarr;</span></a>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </article>
        <?php endforeach; ?>

        <details class="delivery-note">
            <summary>Portal delivery details</summary>
            <div>
                <p><strong>Server rendering:</strong> Routes are handled by <code>index.php</code>; content lives in <code>data/pages.php</code>; HTML and Markdown share the same page data.</p>
                <p><strong>Dependency boundary:</strong> No WordPress bootstrap, database, Composer package, npm build, CDN script, Bootstrap, or jQuery dependency.</p>
                <p><strong>Deployment:</strong> The package targets the subdomain root with Apache or equivalent clean-route rewriting.</p>
            </div>
        </details>
    </section>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
