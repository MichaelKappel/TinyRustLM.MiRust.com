<?php /** @var array $site */ ?>
</main>
<footer class="site-footer">
    <div class="shell footer-grid">
        <section>
            <h2>TinyRustLM</h2>
            <p>Developer documentation for a browser-local Rust/WASM small language model runtime.</p>
            <a class="footer-app" href="<?= e($site['public_app']) ?>" target="_blank" rel="noopener noreferrer">Open the TinyRustLM app <span aria-hidden="true">&rarr;</span></a>
        </section>
        <nav aria-label="Footer engineering navigation">
            <h2>Engineering</h2>
            <a href="/architecture/">Architecture</a>
            <a href="/runtime/">Runtime</a>
            <a href="/slm-format/">.slm format</a>
            <a href="/testing/">Testing</a>
        </nav>
        <nav aria-label="Footer evidence navigation">
            <h2>Evidence</h2>
            <a href="/developer-portal/">Developer portal</a>
            <a href="/docs/">Docs and memory</a>
            <a href="/llms.txt">llms.txt</a>
            <a href="/sitemap.xml">sitemap.xml</a>
        </nav>
        <section>
            <h2>Project</h2>
            <p><a href="/contact/">Contact Mike Kappel</a></p>
            <p class="version">Site package <?= e($site['version']) ?><br>Updated <?= e($site['updated_utc']) ?></p>
        </section>
    </div>
</footer>
<button class="back-to-top" type="button" aria-label="Back to top" title="Back to top"><span aria-hidden="true">&uarr;</span></button>
<p class="copy-status visually-hidden" aria-live="polite"></p>
</body>
</html>
