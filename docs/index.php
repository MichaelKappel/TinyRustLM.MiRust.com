<?php
$site = require __DIR__ . '/../data/site.php';
$reports = require __DIR__ . '/reports-index.php';
require __DIR__ . '/../includes/functions.php';
$route = '/docs/';
$page = [
    'title' => 'TinyRustLM Docs and UAI Memory',
    'summary' => 'Durable report archive, long-term memory, and .uai file-memory routes for the TinyRustLM plain PHP project site.',
    'badge' => 'Docs + Memory',
    'actions' => [
        ['label' => 'Open long-term memory', 'href' => '/docs/long-term-memory.md'],
        ['label' => 'Open report index', 'href' => '/docs/report-index.md'],
        ['label' => 'Open .uai index', 'href' => '/.uai/index.uai'],
    ],
    'sections' => [
        [
            'heading' => 'What lives here',
            'body' => 'The docs folder preserves the report bodies and long-term project memory that support the public TinyRustLM site. The .uai folder acts as compact agent memory and deep-links into these durable Markdown targets instead of duplicating all report text inside hot memory files.',
            'points' => ['Report bodies in /docs/reports/', 'Long-term memory in /docs/long-term-memory.md', 'Pointer ledger in /.uai/long-term-memory.uai', 'File handoff state in /.uai/file-handoff.uai'],
        ],
        [
            'heading' => 'How agents should read it',
            'body' => 'Start with /.uai/index.uai, then read /.uai/startup-packet.uai, /.uai/short-term-memory.uai, and /.uai/long-term-memory.uai. Use /docs/report-index.md to locate full source reports only when needed.',
            'points' => ['Load hot .uai files first', 'Follow pointer records to docs', 'Avoid bulk-loading all reports unless the task requires it', 'Keep report bodies in docs and summaries in .uai'],
        ],
    ],
    'cards' => []
];
if (wants_markdown()) { serve_markdown($site, $route, $page); }
require __DIR__ . '/../includes/header.php';
?>
<section class="hero">
    <div class="shell hero-grid">
        <div class="hero-copy">
            <p class="eyebrow"><?= e($page['badge']) ?></p>
            <h1><?= e($page['title']) ?></h1>
            <p class="lede"><?= e($page['summary']) ?></p>
            <div class="hero-actions" aria-label="Docs actions">
                <?php foreach ($page['actions'] as $action): ?>
                    <a class="button" href="<?= e($action['href']) ?>"><?= e($action['label']) ?></a>
                <?php endforeach; ?>
            </div>
        </div>
        <aside class="runtime-card" aria-label="Memory package summary">
            <h2>Memory surfaces</h2>
            <dl>
                <div><dt>Hot memory</dt><dd>.uai files</dd></div>
                <div><dt>Durable memory</dt><dd>/docs/*.md</dd></div>
                <div><dt>Reports</dt><dd><?= count($reports) ?> preserved</dd></div>
                <div><dt>Mode</dt><dd>Pointer ledger</dd></div>
            </dl>
        </aside>
    </div>
</section>
<section class="content shell">
    <?php foreach ($page['sections'] as $index => $section): ?>
        <article class="content-section" id="section-<?= (int)$index + 1 ?>">
            <p class="section-index">0<?= (int)$index + 1 ?></p>
            <div>
                <h2><?= e($section['heading']) ?></h2>
                <p><?= e($section['body']) ?></p>
                <ul class="check-list">
                    <?php foreach ($section['points'] as $point): ?><li><?= e($point) ?></li><?php endforeach; ?>
                </ul>
            </div>
        </article>
    <?php endforeach; ?>
    <article class="content-section" id="reports">
        <p class="section-index">03</p>
        <div>
            <h2>Preserved reports</h2>
            <p>All attached TinyRustLM, Rust/WASM, native web, agent-readable web, and virality reports are copied into the docs folder with stable relative paths and checksums.</p>
            <div class="docs-table-wrap">
                <table class="docs-table">
                    <thead><tr><th>Report</th><th>Role</th><th>Checksum</th></tr></thead>
                    <tbody>
                    <?php foreach ($reports as $report): ?>
                        <tr>
                            <td><a href="<?= e($report['url']) ?>"><?= e($report['title']) ?></a><br><small><?= e($report['source_filename']) ?></small></td>
                            <td><?= e($report['summary']) ?></td>
                            <td><code><?= e(substr($report['sha256'], 0, 16)) ?></code></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </article>
</section>
<section class="shell proof-panel">
    <h2>UAI memory read order</h2>
    <div class="proof-grid">
        <p><a href="/.uai/index.uai">.uai/index.uai</a> lists the file-memory suite and the recommended read order.</p>
        <p><a href="/.uai/long-term-memory.uai">.uai/long-term-memory.uai</a> is the semantic pointer ledger with deep links to each durable report and long-term memory body.</p>
        <p><a href="/docs/report-index.md">docs/report-index.md</a> is the human- and agent-readable report manifest with checksums.</p>
    </div>
</section>
<?php require __DIR__ . '/../includes/footer.php'; ?>
