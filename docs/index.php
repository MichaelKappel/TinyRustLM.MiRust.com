<?php
$site = require __DIR__ . '/../data/site.php';
$reports = require __DIR__ . '/reports-index.php';
require __DIR__ . '/../includes/functions.php';
$route = '/docs/';
$page = [
    'title' => 'TinyRustLM Docs and Public Records',
    'summary' => 'Current boundary documentation, long-term policy, and bounded public pointer records for the TinyRustLM plain PHP project site.',
    'badge' => 'Docs + Records',
    'actions' => [
        ['label' => 'Open long-term memory', 'href' => '/docs/long-term-memory.md'],
        ['label' => 'Open report index', 'href' => '/docs/report-index.md'],
        ['label' => 'Open .uai index', 'href' => '/.uai/index.uai'],
    ],
    'sections' => [
        [
            'heading' => 'What lives here',
            'body' => 'The docs folder publishes current boundary records and long-term policy. Historical report bodies remain repository-retained outside the public deployment closure, while two bounded public pointer records link only to current durable targets.',
            'points' => ['Historical report identity boundary in /docs/report-index.md', 'Long-term policy in /docs/long-term-memory.md', 'Public index in /.uai/index.uai', 'Public pointer ledger in /.uai/long-term-memory.uai'],
        ],
        [
            'heading' => 'How agents should read it',
            'body' => 'Start with /.uai/index.uai, follow /.uai/long-term-memory.uai to current public policy, and use /docs/report-index.md only for historical report identities and retirement status.',
            'points' => ['Use only the two public pointer records', 'Follow pointer records to current docs', 'Do not treat retired reports as live evidence', 'Treat repository governance as non-public'],
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
        <aside class="runtime-card" aria-label="Public records summary">
            <h2>Public records</h2>
            <dl>
                <div><dt>Pointers</dt><dd>2 public .uai files</dd></div>
                <div><dt>Durable docs</dt><dd>/docs/*.md</dd></div>
                <div><dt>Reports</dt><dd><?= count($reports) ?> repository-retained</dd></div>
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
            <h2>Historical report identities</h2>
            <p>The report bodies are retained outside the public deployment closure. This current boundary lists their historical roles and checksums without exposing direct content routes.</p>
            <div class="docs-table-wrap">
                <table class="docs-table">
                    <thead><tr><th>Report</th><th>Role</th><th>Checksum</th></tr></thead>
                    <tbody>
                    <?php foreach ($reports as $report): ?>
                        <tr>
                            <td><?= e($report['title']) ?><br><small><?= e($report['source_filename']) ?></small></td>
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
    <h2>Public record read order</h2>
    <div class="proof-grid">
        <p><a href="/.uai/index.uai">.uai/index.uai</a> lists the two public pointer records and their read order.</p>
        <p><a href="/.uai/long-term-memory.uai">.uai/long-term-memory.uai</a> is the semantic pointer ledger for current public boundary documents.</p>
        <p><a href="/docs/report-index.md">docs/report-index.md</a> is the human- and agent-readable historical identity and retirement manifest.</p>
    </div>
</section>
<?php require __DIR__ . '/../includes/footer.php'; ?>
