<?php /** @var array $site */ ?>
</main>
<footer class="site-footer">
    <div class="shell footer-grid">
        <section>
            <h2>TinyRustLM</h2>
            <p>Plain PHP project site for a zero-dependency Rust/WASM browser-local SLM runtime.</p>
        </section>
        <section>
            <h2>Machine-readable</h2>
            <p><a href="/llms.txt">llms.txt</a> · <a href="/llms-full.txt">llms-full.txt</a> · <a href="/docs/">docs</a> · <a href="/docs/long-term-memory.md">long-term memory</a> · <a href="/sitemap.xml">sitemap.xml</a> · <a href="/robots.txt">robots.txt</a></p>
        </section>
        <section>
            <h2><a href="/contact/">Contact Mike Kappel</a></h2>
            <p><a href="mailto:<?= e($site['contact']['email']) ?>"><?= e($site['contact']['email']) ?></a><br><a href="tel:<?= e($site['contact']['phone_tel']) ?>"><?= e($site['contact']['phone_display']) ?></a><br><a href="<?= e($site['contact']['contact_hub']) ?>" target="_blank" rel="noopener noreferrer">MJK.tel contact hub</a></p>
        </section>
        <section>
            <h2>Version</h2>
            <p>Site package <?= e($site['version']) ?><br>Updated <?= e($site['updated_utc']) ?></p>
        </section>
    </div>
</footer>
</body>
</html>
