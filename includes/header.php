<?php /** @var array $site */ /** @var array $page */ /** @var string $route */ ?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($page['title']) ?></title>
    <meta name="description" content="<?= e($page['summary']) ?>">
    <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
    <meta name="theme-color" content="#173b57">
    <link rel="canonical" href="<?= e(rtrim($site['domain'], '/') . $route) ?>">
    <link rel="alternate" type="text/markdown" href="<?= e($route . '?format=md') ?>">
    <link rel="icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=">
    <link rel="stylesheet" href="/assets/css/site.css?v=<?= e($site['version']) ?>">
    <script src="/assets/js/site.js?v=<?= e($site['version']) ?>" defer></script>
    <meta property="og:title" content="<?= e($page['title']) ?>">
    <meta property="og:description" content="<?= e($page['summary']) ?>">
    <meta property="og:type" content="website">
    <meta property="og:url" content="<?= e(rtrim($site['domain'], '/') . $route) ?>">
    <script type="application/ld+json">
    <?= json_encode([
        '@context' => 'https://schema.org',
        '@graph' => [
            [
                '@type' => 'SoftwareSourceCode',
                'name' => $site['name'],
                'description' => $site['description'],
                'codeRepository' => $site['domain'],
                'programmingLanguage' => ['Rust', 'WebAssembly', 'PHP', 'JavaScript'],
                'runtimePlatform' => ['Browser', 'WebAssembly'],
                'softwareRequirements' => 'Modern browser with WebAssembly support',
                'license' => 'Project-specific; verify artifact and model licenses individually',
                'dateModified' => $site['updated_utc'],
                'author' => ['@id' => $site['contact']['personal_site'] . '#person'],
            ],
            [
                '@id' => $site['contact']['personal_site'] . '#person',
                '@type' => 'Person',
                'name' => $site['contact']['full_name'],
                'alternateName' => $site['contact']['name'],
                'jobTitle' => $site['contact']['role'],
                'email' => $site['contact']['email'],
                'telephone' => $site['contact']['phone_tel'],
                'address' => $site['contact']['location'],
                'url' => $site['contact']['personal_site'],
                'sameAs' => [$site['contact']['contact_hub'], $site['contact']['linkedin'], $site['contact']['github'], $site['contact']['nuget']],
            ],
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) ?>
    </script>
</head>
<body class="route-<?= e(trim($route, '/') === '' ? 'home' : str_replace('/', '-', trim($route, '/'))) ?>">
<a class="skip-link" href="#main">Skip to content</a>
<div class="reading-progress" aria-hidden="true"><span></span></div>
<header class="site-header">
    <div class="status-bar">
        <div class="shell status-inner">
            <p><strong>TinyRustLM developer portal</strong><span>Rust/WASM runtime, <code>.slm</code> contracts, and proof evidence</span></p>
            <nav aria-label="Utility navigation">
                <a href="/docs/">Docs</a>
                <a href="/llms.txt">llms.txt</a>
                <a href="/contact/">Contact</a>
            </nav>
        </div>
    </div>
    <div class="shell header-main">
        <a class="brand" href="/" aria-label="TinyRustLM developer portal home">
            <span class="brand-mark" aria-hidden="true">TR</span>
            <span><strong>TinyRustLM</strong><small>Local model engineering</small></span>
        </a>
        <div class="header-tools">
            <button class="search-toggle" type="button" aria-haspopup="dialog" aria-controls="quick-find">Find</button>
            <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button>
            <a class="app-link" href="<?= e($site['public_app']) ?>" target="_blank" rel="noopener noreferrer">Open app</a>
        </div>
        <nav id="primary-nav" class="primary-nav" aria-label="Primary navigation">
            <?php foreach ($site['nav_groups'] as $group): ?>
                <?php if (($group['type'] ?? '') === 'link' || ($group['type'] ?? '') === 'cta'): ?>
                    <a class="nav-link<?= is_active_path($route, $group['path'] ?? null) ? ' active' : '' ?>" href="<?= e(nav_href($group)) ?>"<?= is_active_path($route, $group['path'] ?? null) ? ' aria-current="page"' : '' ?>>
                        <span><?= e($group['label']) ?></span>
                    </a>
                <?php else: ?>
                    <details class="<?= e(nav_group_class($route, $group)) ?>">
                        <summary><span><?= e($group['label']) ?></span><small><?= e($group['description'] ?? '') ?></small></summary>
                        <div class="nav-menu" role="list">
                            <?php foreach ($group['items'] ?? [] as $item): ?>
                                <?php $href = nav_href($item); $active = is_active_path($route, $item['path'] ?? null); ?>
                                <a role="listitem" href="<?= e($href) ?>"<?= external_link_attrs($href) ?><?= $active ? ' aria-current="page" class="active"' : '' ?>>
                                    <strong><?= e($item['label']) ?></strong>
                                    <span><?= e($item['description'] ?? '') ?></span>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    </details>
                <?php endif; ?>
            <?php endforeach; ?>
        </nav>
    </div>
</header>

<dialog id="quick-find" class="quick-find" aria-labelledby="quick-find-title">
    <div class="quick-find-header">
        <div><p class="dialog-label">Navigate the portal</p><h2 id="quick-find-title">Quick find</h2></div>
        <button class="quick-find-close" type="button" aria-label="Close quick find">Close</button>
    </div>
    <label for="quick-find-input">Filter pages</label>
    <input id="quick-find-input" type="search" autocomplete="off" placeholder="Architecture, quantization, testing...">
    <nav class="quick-find-results" aria-label="Portal pages">
        <?php foreach ($site['nav'] as $path => $label): ?>
            <a href="<?= e($path) ?>" data-search-value="<?= e(strtolower($label . ' ' . $path)) ?>"><strong><?= e($label) ?></strong><span><?= e($path) ?></span></a>
        <?php endforeach; ?>
    </nav>
    <p class="quick-find-empty" hidden>No matching portal page.</p>
</dialog>

<main id="main" tabindex="-1">
